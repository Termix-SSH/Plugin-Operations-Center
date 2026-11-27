import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type TabsApi,
  useCurrentUser,
  useHosts,
  useToast,
  useTranslation,
} from "@termix-ssh/plugin-sdk/frontend";
import {
  Button,
  Checkbox,
  Field,
  Input,
  NoticePanel,
  PanelShell,
  copyToClipboard,
  createApiKey,
  getBasePath,
  getMyApiKeys,
  revokeMyApiKey,
  type ApiKey,
  type CreatedApiKey,
} from "@termix-ssh/plugin-sdk/ui";
import { Bot, Copy, ShieldAlert } from "lucide-react";
import { errorText, listApprovals, listRuns, type Run } from "./api";
import { AI_CLIENTS, mcpUrl, setupFor, type AiClient } from "./connect-ai";
import { hostLabel } from "./hosts";
import { Choice, Section, StateBadge, when } from "./parts";

const OPERATIONS_TAB = "operations";
const ACCESS = ["operations:read", "operations:run"] as const;
type Access = (typeof ACCESS)[number];

interface Grant {
  hostIds?: number[];
  autoApprove?: boolean;
}

/** The grant argument needs Termix 26.11.4. Older servers ignore it. */
const createKey = createApiKey as (
  name: string,
  userId: string,
  expiresAt: string | undefined,
  scopes: string[],
  grant: Grant,
) => Promise<CreatedApiKey & Grant>;

type HeldKey = ApiKey & { hostIds?: string | null; autoApprove?: boolean };

function scopesOf(key: ApiKey): string[] {
  const raw = key.scopes as unknown;
  if (Array.isArray(raw)) return raw;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function hostCount(key: HeldKey): number | null {
  try {
    return key.hostIds ? (JSON.parse(key.hostIds) as number[]).length : null;
  } catch {
    return 0;
  }
}

/** One place to give an outside AI tool a key, and see what it did with it. */
export function ConnectAiTab({ tabs }: { tabs: TabsApi }) {
  const { t } = useTranslation();
  const toast = useToast();
  const user = useCurrentUser();
  const { hosts } = useHosts();

  const [client, setClient] = useState<AiClient>("claude");
  const [url, setUrl] = useState(() =>
    mcpUrl(window.location.origin, getBasePath()),
  );
  const [access, setAccess] = useState<Access>("operations:run");
  const [allHosts, setAllHosts] = useState(true);
  const [picked, setPicked] = useState<number[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [keys, setKeys] = useState<HeldKey[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [waiting, setWaiting] = useState(0);

  const load = useCallback(async () => {
    const [mine, recent, approvals] = await Promise.all([
      getMyApiKeys().catch(() => ({ apiKeys: [] })),
      listRuns({ limit: 100 }).catch(() => []),
      listApprovals().catch(() => []),
    ]);
    setKeys(
      mine.apiKeys.filter((key) =>
        scopesOf(key).some((scope) => scope.startsWith("operations:")),
      ),
    );
    setRuns(recent.filter((run) => run.origin?.via === "mcp").slice(0, 10));
    setWaiting(
      approvals.filter((item) => item.run.origin?.via === "mcp").length,
    );
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const setup = useMemo(
    () => setupFor(client, url, token ?? t("connect.keyPlaceholder")),
    [client, url, token, t],
  );

  const toggleHost = (id: number) =>
    setPicked((now) =>
      now.includes(id) ? now.filter((entry) => entry !== id) : [...now, id],
    );

  const create = async () => {
    if (!user) return;
    const grant: Grant = {
      ...(allHosts ? {} : { hostIds: picked }),
      ...(autoApprove ? { autoApprove: true } : {}),
    };
    setBusy(true);
    try {
      const key = await createKey(
        t("connect.keyName", { client: t(`connect.clients.${client}`) }),
        user.userId,
        undefined,
        [access],
        grant,
      );
      // An older server made a key with no host limit. Don't hand that out.
      if (grant.hostIds && !key.hostIds) {
        await revokeMyApiKey(key.id);
        throw new Error(t("connect.needsNewer"));
      }
      setToken(key.token);
      await load();
    } catch (error) {
      toast.error(errorText(error, t("connect.createFailed")));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (await copyToClipboard(setup)) toast.success(t("connect.copied"));
    else toast.error(t("connect.copyFailed"));
  };

  const revoke = async (key: ApiKey) => {
    try {
      await revokeMyApiKey(key.id);
      await load();
    } catch (error) {
      toast.error(errorText(error, t("connect.revokeFailed")));
    }
  };

  const canCreate = !!user?.isAdmin && (allHosts || picked.length > 0);

  return (
    <PanelShell icon={<Bot className="size-4" />} title={t("connect.title")}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-3 text-xs">
        <p className="text-sm text-muted-foreground">{t("connect.intro")}</p>

        <Section title={t("connect.stepAccess")}>
          <Field label={t("connect.access")}>
            <Choice
              label={t("connect.access")}
              value={access}
              onChange={(next: Access) => setAccess(next)}
              options={ACCESS.map((value) => ({
                value,
                label: t(`connect.accessOptions.${value}`),
              }))}
            />
          </Field>
          <Field label={t("connect.hosts")}>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={allHosts}
                onCheckedChange={(checked) => setAllHosts(checked === true)}
              />
              {t("connect.allHosts")}
            </label>
            {!allHosts && (
              <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-auto border border-border p-2">
                {hosts.map((host) => (
                  <label key={host.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={picked.includes(Number(host.id))}
                      onCheckedChange={() => toggleHost(Number(host.id))}
                    />
                    {hostLabel(host)}
                  </label>
                ))}
              </div>
            )}
          </Field>
          {access === "operations:run" && (
            <Field label={t("connect.approval")}>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={autoApprove}
                  onCheckedChange={(checked) =>
                    setAutoApprove(checked === true)
                  }
                />
                {t("connect.autoApprove")}
              </label>
              <p className="mt-1 text-muted-foreground">
                {t(
                  autoApprove
                    ? "connect.autoApproveOn"
                    : "connect.autoApproveOff",
                )}
              </p>
            </Field>
          )}
          {user?.isAdmin ? (
            <div>
              <Button
                size="sm"
                disabled={busy || !canCreate}
                onClick={() => void create()}
              >
                {t("connect.create")}
              </Button>
            </div>
          ) : (
            <NoticePanel icon={ShieldAlert} title={t("connect.adminOnly")} />
          )}
        </Section>

        <Section
          title={t("connect.stepSetup")}
          action={
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              <Copy className="size-3.5" />
              {t("connect.copy")}
            </Button>
          }
        >
          <div className="flex flex-wrap gap-1">
            {AI_CLIENTS.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setClient(entry)}
                className={`border px-2 py-0.5 text-xs ${client === entry ? "border-accent-brand text-accent-brand" : "border-border text-muted-foreground"}`}
              >
                {t(`connect.clients.${entry}`)}
              </button>
            ))}
          </div>
          <Field label={t("connect.address")} hint={t("connect.addressHint")}>
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </Field>
          <p className="text-muted-foreground">
            {t(`connect.where.${client}`)}
          </p>
          <pre className="overflow-auto whitespace-pre-wrap break-all bg-muted p-2 font-mono text-[11px]">
            {setup}
          </pre>
          {token && (
            <p className="text-muted-foreground">{t("connect.shownOnce")}</p>
          )}
        </Section>

        <Section title={t("connect.keys")}>
          {keys.length === 0 && (
            <p className="text-muted-foreground">{t("connect.noKeys")}</p>
          )}
          {keys.map((key) => {
            const count = hostCount(key);
            return (
              <div
                key={key.id}
                className="flex items-center gap-2 border-b border-border py-1.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{key.name}</div>
                  <div className="text-muted-foreground">
                    {[
                      t(`connect.accessOptions.${scopesOf(key)[0]}`),
                      count === null
                        ? t("connect.allHosts")
                        : t("connect.hostCount", { count }),
                      key.autoApprove && t("connect.noApproval"),
                      key.lastUsedAt
                        ? t("connect.lastUsed", { time: when(key.lastUsedAt) })
                        : t("connect.neverUsed"),
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void revoke(key)}
                >
                  {t("connect.revoke")}
                </Button>
              </div>
            );
          })}
        </Section>

        <Section
          title={t("connect.activity")}
          action={
            waiting > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  tabs.openSingletonTab(OPERATIONS_TAB, {
                    data: { view: "approvals" },
                  })
                }
              >
                {t("connect.waiting", { count: waiting })}
              </Button>
            )
          }
        >
          {runs.length === 0 && (
            <p className="text-muted-foreground">{t("connect.noActivity")}</p>
          )}
          {runs.map((run) => (
            <div key={run.id} className="flex items-center gap-2 py-0.5">
              <StateBadge state={run.status} />
              <span className="min-w-0 flex-1 truncate">
                {[run.actionId, run.hostName, run.summary]
                  .filter(Boolean)
                  .join(" | ")}
              </span>
              <span className="text-muted-foreground">
                {when(run.createdAt)}
              </span>
            </div>
          ))}
        </Section>
      </div>
    </PanelShell>
  );
}
