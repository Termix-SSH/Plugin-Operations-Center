import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import {
  partsShown,
  SETTLE_CAP_MS,
  useSettled,
} from "../../src/frontend/tiles/settle";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Page({
  ready,
  parts,
  onSettled,
}: {
  ready: boolean;
  parts: boolean[];
  onSettled: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useSettled(box, ready, onSettled);
  return (
    <div ref={box}>
      {parts.map((shown, index) => (
        <div
          key={index}
          data-foreign-id={`v${index}`}
          data-foreign-shown={shown ? "" : undefined}
        />
      ))}
    </div>
  );
}

const nextFrame = () =>
  act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });

describe("partsShown", () => {
  it("waits for every part from another plugin", () => {
    const box = document.createElement("div");
    box.innerHTML =
      '<div data-foreign-id="a" data-foreign-shown></div><div data-foreign-id="b"></div>';
    expect(partsShown(box)).toBe(false);
    box.children[1].setAttribute("data-foreign-shown", "");
    expect(partsShown(box)).toBe(true);
  });
});

describe("useSettled", () => {
  it("settles once the data is in and every part painted", async () => {
    const onSettled = vi.fn();
    const view = render(
      <Page ready={false} parts={[false]} onSettled={onSettled} />,
    );
    await nextFrame();
    expect(onSettled).not.toHaveBeenCalled();
    view.rerender(<Page ready parts={[false]} onSettled={onSettled} />);
    await nextFrame();
    expect(onSettled).not.toHaveBeenCalled();
    view.rerender(<Page ready parts={[true]} onSettled={onSettled} />);
    await nextFrame();
    expect(onSettled).toHaveBeenCalled();
  });

  it("shows the page anyway when a part never paints", () => {
    vi.useFakeTimers();
    const onSettled = vi.fn();
    render(<Page ready parts={[false]} onSettled={onSettled} />);
    act(() => vi.advanceTimersByTime(SETTLE_CAP_MS));
    expect(onSettled).toHaveBeenCalled();
  });
});
