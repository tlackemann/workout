import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import type { ReactNode } from 'react';

/** Groups focusables so focus is remembered per group and kept inside it when asked. */
export function FocusGroup(props: {
  readonly focusKey: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly boundary?: boolean;
  readonly preferredChildFocusKey?: string;
}) {
  const { ref, focusKey } = useFocusable<object, HTMLDivElement>({
    focusKey: props.focusKey,
    trackChildren: true,
    saveLastFocusedChild: true,
    isFocusBoundary: props.boundary ?? false,
    preferredChildFocusKey: props.preferredChildFocusKey,
  });
  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className={props.className}>
        {props.children}
      </div>
    </FocusContext.Provider>
  );
}
