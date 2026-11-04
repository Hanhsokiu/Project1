import {
  Children, Fragment, cloneElement, isValidElement, useEffect, useId,
  useLayoutEffect, useRef, useState, type ReactElement, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export function actionChildren(children: ReactNode): ReactElement[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    return child.type === Fragment
      ? actionChildren((child.props as { children?: ReactNode }).children)
      : [child];
  });
}

/** Keeps existing links and callbacks intact while providing a keyboard menu. */
export function ActionMenu({ children, label = "Thao tác khác", compact = true }: {
  children: ReactNode; label?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const actions = actionChildren(children);
  const close = (focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const panel = menu.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(280, window.innerWidth - 24);
      const height = panel?.height || 200;
      setPosition({
        left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)),
        top: anchor.bottom + height + 8 > window.innerHeight
          ? Math.max(12, anchor.top - height - 6) : anchor.bottom + 6,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const first = menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])');
    first?.focus();
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  if (!actions.length) return null;
  return (
    <>
      <button ref={trigger} type="button" className={compact ? "icon-btn action-menu-trigger" : "btn btn-secondary action-menu-trigger"}
        aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); }
        }}>
        <MoreHorizontal size={18} aria-hidden="true" />{!compact && <span>Thao tác khác</span>}
      </button>
      {open && createPortal(
        <div ref={menu} id={id} role="menu" aria-label={label} className="action-menu-panel"
          style={{ top: position.top, left: position.left }}
          onKeyDown={event => {
            const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])') || []);
            const index = items.indexOf(document.activeElement as HTMLElement);
            if (event.key === "Escape") { event.preventDefault(); close(true); }
            if (event.key === "Tab") close(true);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
                : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
              items[next]?.focus();
            }
          }}>
          {actions.map((element, index) => {
            const props = element.props as {
              children?: ReactNode; "aria-label"?: string; className?: string;
              onClick?: (event: React.MouseEvent<HTMLElement>) => void;
            };
            const text = Children.toArray(props.children).some(child => typeof child === "string" && child.trim());
            return cloneElement(element as ReactElement<Record<string, unknown>>, {
              key: element.key ?? index, role: "menuitem", tabIndex: -1,
              className: `${props.className || ""} action-menu-item`,
              children: <>{props.children}{!text && props["aria-label"] && <span>{props["aria-label"]}</span>}</>,
              onClick: (event: React.MouseEvent<HTMLElement>) => { close(true); props.onClick?.(event); },
            });
          })}
        </div>, document.body,
      )}
    </>
  );
}

export function PageActions({ children }: { children: ReactNode }) {
  const actions = actionChildren(children);
  const isPrimary = (element: ReactElement) => {
    const props = element.props as { variant?: string; className?: string };
    return props.className?.includes("btn-primary") ||
      (typeof element.type !== "string" && !props.variant && !props.className) || props.variant === "primary";
  };
  const primary = actions.find(isPrimary);
  const secondary = actions.filter(action => action !== primary);
  return <div className="actions page-actions">
    {secondary.length <= 1 ? secondary : <ActionMenu compact={false}>{secondary}</ActionMenu>}
    {primary}
  </div>;
}
