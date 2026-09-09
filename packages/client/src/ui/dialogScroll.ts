/** Open overflow dialogs at the top so the header is visible, then scroll down. */
export function resetDialogScroll(root: HTMLElement) {
  const run = () => {
    root.scrollTop = 0;
    root.scrollLeft = 0;
    for (const node of root.querySelectorAll("*")) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.scrollTop || node.scrollLeft) {
        node.scrollTop = 0;
        node.scrollLeft = 0;
      }
    }
  };
  run();
  requestAnimationFrame(run);
}
