import { useRouter } from '../../app/router.tsx';
import { paths, PROGRESS_TABS, type ProgressTab } from '../../app/routes.ts';
import { FocusButton } from '../../components/FocusButton.tsx';
import { FocusGroup } from '../../components/FocusGroup.tsx';
import { cx } from '../../lib/cx.ts';

export const TAB_LABELS: Record<ProgressTab, string> = {
  lifts: 'Lifts',
  consistency: 'Consistency',
  sessions: 'Sessions',
  muscles: 'Muscles',
};

/**
 * The view follows focus: ◀▶ along the tabs switches views without OK. Tab changes replace
 * the history entry, so BACK always returns Home in one press and a reload keeps the tab.
 */
export function ProgressTabs(props: { readonly active: ProgressTab }) {
  const { navigate } = useRouter();
  const show = (tab: ProgressTab) => {
    if (tab !== props.active) navigate(paths.progress(tab), { replace: true });
  };
  return (
    <FocusGroup focusKey="progress-tabs" className="flex gap-4" preferredChildFocusKey={`tab-${props.active}`}>
      {PROGRESS_TABS.map((tab) => (
        <FocusButton
          key={tab}
          focusKey={`tab-${tab}`}
          testId={`tab-${tab}`}
          autoFocus={tab === props.active}
          onFocused={() => show(tab)}
          onPress={() => show(tab)}
          className={cx(
            'rounded-2xl border-b-[0.375rem] px-8 py-3 font-display text-[2.25rem] font-semibold uppercase tracking-wide',
            tab === props.active ? 'border-text bg-surface-2 text-text' : 'border-transparent text-dim',
          )}
        >
          {TAB_LABELS[tab]}
        </FocusButton>
      ))}
    </FocusGroup>
  );
}
