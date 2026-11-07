import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect, type ReactNode } from 'react';
import { cx } from '../lib/cx.ts';

export interface FocusButtonProps {
  readonly children: ReactNode;
  readonly onPress?: () => void;
  /** Return false to stop spatial navigation for that direction (e.g. a stepper consuming ◀▶). */
  readonly onArrow?: (direction: 'left' | 'right' | 'up' | 'down') => boolean;
  readonly onFocused?: () => void;
  readonly focusKey?: string;
  readonly autoFocus?: boolean;
  readonly className?: string;
  readonly focusedClassName?: string;
  readonly flat?: boolean;
  readonly label?: string;
  readonly testId?: string;
}

/**
 * A D-pad focusable that also works with touch/mouse (Settings from a phone).
 * Rendered as a div: a real <button> would fire twice on OK (keydown + synthetic click).
 */
export function FocusButton(props: FocusButtonProps) {
  const { ref, focused, focusSelf } = useFocusable<object, HTMLDivElement>({
    focusKey: props.focusKey,
    onEnterPress: () => props.onPress?.(),
    onArrowPress: (direction) => props.onArrow?.(direction as 'left' | 'right' | 'up' | 'down') ?? true,
    onFocus: () => {
      ref.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      props.onFocused?.();
    },
  });

  useEffect(() => {
    if (props.autoFocus) focusSelf();
    // Only on mount: autoFocus is an initial-focus hint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      role="button"
      aria-label={props.label}
      aria-pressed={undefined}
      data-focused={focused ? 'true' : 'false'}
      data-testid={props.testId}
      onClick={() => props.onPress?.()}
      className={cx('focusable', focused && 'is-focused', focused && props.focusedClassName, props.flat && 'focus-flat', props.className)}
    >
      {props.children}
    </div>
  );
}
