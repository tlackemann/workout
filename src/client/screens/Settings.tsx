import { DAYS, DAY_LABELS, LENGTH_LABELS, SESSION_LENGTHS, type Day } from '../../core/days.ts';
import { EQUIPMENT_CATALOGUE, isEligible, type EquipmentTag } from '../../core/equipment.ts';
import { STRETCH_HOLD, STRETCH_SETUP, type Settings as SettingsValue } from '../../core/settings.ts';
import { TEMPLATES } from '../../data/templates.ts';
import { useAppData } from '../app/AppData.tsx';
import { FocusGroup } from '../components/FocusGroup.tsx';
import { KeyLegend } from '../components/KeyLegend.tsx';
import { Screen } from '../components/Screen.tsx';
import { formatWeight } from '../lib/format.ts';
import { ChoiceRow, Section, StepperRow, ToggleRow, clamp } from './settings/rows.tsx';

const STANDARD_PLATES = [45, 35, 25, 10, 5, 2.5] as const;
const GROUPS = [...new Set(EQUIPMENT_CATALOGUE.map((e) => e.group))];
const STATIONS = EQUIPMENT_CATALOGUE.filter((e) => e.tag.startsWith('mx.'));

type Update = (patch: Partial<SettingsValue>) => void;

function WorkoutSection({ s, set }: { readonly s: SettingsValue; readonly set: Update }) {
  return (
    <Section title="Workout">
      <ChoiceRow
        label="Default session length"
        options={SESSION_LENGTHS.map((l) => ({ value: l, label: LENGTH_LABELS[l] }))}
        value={s.defaultLength}
        onChange={(defaultLength) => set({ defaultLength })}
        testId="setting-length"
      />
      <StepperRow label="Get-ready countdown" value={`${s.getReadySec} s`} onStep={(d) => set({ getReadySec: clamp(s.getReadySec + d * 5, 0, 30) })} />
      <StepperRow label="Extra time between exercises" value={`${s.changeoverSec} s`} onStep={(d) => set({ changeoverSec: clamp(s.changeoverSec + d * 15, 0, 180) })} />
    </Section>
  );
}

function StretchSection({ s, set }: { readonly s: SettingsValue; readonly set: Update }) {
  const stretch = s.stretch;
  return (
    <Section title="Stretching" hint="Applies to static stretches. Warm-up and foam-roll moves keep their own timing.">
      <StepperRow
        label="Hold each stretch"
        value={`${stretch.holdSec} s`}
        onStep={(d) => set({ stretch: { ...stretch, holdSec: clamp(stretch.holdSec + d * STRETCH_HOLD.step, STRETCH_HOLD.min, STRETCH_HOLD.max) } })}
        testId="setting-stretch-hold"
      />
      <StepperRow
        label="Time to get into position"
        value={`${stretch.setupSec} s`}
        onStep={(d) => set({ stretch: { ...stretch, setupSec: clamp(stretch.setupSec + d * STRETCH_SETUP.step, STRETCH_SETUP.min, STRETCH_SETUP.max) } })}
        testId="setting-stretch-setup"
      />
    </Section>
  );
}

function SoundSection({ s, set }: { readonly s: SettingsValue; readonly set: Update }) {
  const audio = s.audio;
  return (
    <Section title="Sound">
      <ToggleRow label="Countdown beeps" on={audio.enabled} onToggle={() => set({ audio: { ...audio, enabled: !audio.enabled } })} testId="setting-sound" />
      <StepperRow
        label="Volume"
        value={`${Math.round(audio.volume * 100)}%`}
        onStep={(d) => set({ audio: { ...audio, volume: clamp(Math.round((audio.volume + d * 0.1) * 10) / 10, 0, 1) } })}
      />
      <ToggleRow label="Keep soundbar awake (inaudible tone)" on={audio.keepAlive} onToggle={() => set({ audio: { ...audio, keepAlive: !audio.keepAlive } })} />
    </Section>
  );
}

function AnchorsSection({ s, set }: { readonly s: SettingsValue; readonly set: Update }) {
  const { library } = useAppData();
  const owned = new Set<string>(s.equipment);
  const rows = DAYS.flatMap((day: Day) =>
    TEMPLATES[day].slots
      .filter((slot) => slot.role === 'anchor')
      .map((slot) => {
        const current = s.anchors[day][slot.id] ?? slot.candidates[0] ?? '';
        const ids = [...new Set([...slot.candidates, ...(slot.fallbacks ?? [])])].filter(
          (id) => id === current || isEligible(library.get(id)?.requires ?? [], owned),
        );
        const options = ids.map((id) => ({ value: id, label: library.get(id)?.name ?? id }));
        return (
          <ChoiceRow
            key={slot.id}
            label={`${DAY_LABELS[day]} · ${slot.label}`}
            options={options}
            value={current}
            onChange={(id) => set({ anchors: { ...s.anchors, [day]: { ...s.anchors[day], [slot.id]: id } } })}
          />
        );
      }),
  );
  return (
    <Section title="Main lifts" hint="The two anchor lifts you progress on each day.">
      {rows}
    </Section>
  );
}

function EquipmentSection({ s, set }: { readonly s: SettingsValue; readonly set: Update }) {
  const toggle = (tag: EquipmentTag) =>
    set({ equipment: s.equipment.includes(tag) ? s.equipment.filter((t) => t !== tag) : [...s.equipment, tag] });
  return (
    <>
      {GROUPS.map((group) => (
        <Section key={group} title={`Equipment · ${group}`}>
          {EQUIPMENT_CATALOGUE.filter((e) => e.group === group).map((e) => (
            <ToggleRow key={e.tag} label={e.label} on={s.equipment.includes(e.tag)} onToggle={() => toggle(e.tag)} testId={`equip-${e.tag}`} />
          ))}
        </Section>
      ))}
    </>
  );
}

function PlatesSection({ s, set }: { readonly s: SettingsValue; readonly set: Update }) {
  const pairsOf = (weight: number) => s.plates.find((p) => p.weight === weight)?.pairs ?? 0;
  const setPairs = (weight: number, pairs: number) => {
    const others = s.plates.filter((p) => p.weight !== weight);
    set({ plates: [...others, { weight, pairs }].sort((a, b) => b.weight - a.weight) });
  };
  return (
    <Section title="Bar & plates" hint="Used for plate math and to pick weights you can actually load.">
      <StepperRow label="Barbell weight" value={`${s.barWeight} lb`} onStep={(d) => set({ barWeight: clamp(s.barWeight + d * 5, 5, 100) })} />
      <StepperRow label="EZ bar weight" value={`${s.ezBarWeight} lb`} onStep={(d) => set({ ezBarWeight: clamp(s.ezBarWeight + d * 5, 5, 60) })} />
      {STANDARD_PLATES.map((w) => (
        <StepperRow key={w} label={`${formatWeight(w)} lb plates (pairs)`} value={`${pairsOf(w)}`} onStep={(d) => setPairs(w, clamp(pairsOf(w) + d, 0, 10))} />
      ))}
    </Section>
  );
}

function StationsSection({ s, set }: { readonly s: SettingsValue; readonly set: Update }) {
  const update = (tag: string, step: number, max: number) =>
    set({ stations: { ...s.stations, [tag]: { min: step, max: Math.max(max, step * 2), step } } });
  return (
    <Section title="MX 4800 stacks" hint="Weight per plate and the heaviest pin setting for each station.">
      {STATIONS.map((station) => {
        const profile = s.stations[station.tag] ?? { min: 10, max: 200, step: 10 };
        return (
          <div key={station.tag} className="grid grid-cols-2 gap-3">
            <StepperRow
              label={`${station.label}: plate`}
              value={`${formatWeight(profile.step)}`}
              onStep={(d) => update(station.tag, clamp(profile.step + d * 2.5, 2.5, 50), profile.max)}
            />
            <StepperRow
              label="max"
              value={`${formatWeight(profile.max)}`}
              onStep={(d) => update(station.tag, profile.step, clamp(profile.max + d * 10, 50, 500))}
            />
          </div>
        );
      })}
    </Section>
  );
}

function ProgressionSection({ s, set }: { readonly s: SettingsValue; readonly set: Update }) {
  const inc = s.increments;
  return (
    <Section title="Progression" hint="How much weight to add once every set hits the top of its rep range.">
      <StepperRow label="Upper-body barbell jump" value={`${formatWeight(inc.upper)} lb`} onStep={(d) => set({ increments: { ...inc, upper: clamp(inc.upper + d * 2.5, 2.5, 20) } })} />
      <StepperRow label="Lower-body barbell jump" value={`${formatWeight(inc.lower)} lb`} onStep={(d) => set({ increments: { ...inc, lower: clamp(inc.lower + d * 2.5, 2.5, 30) } })} />
      <StepperRow label="Dumbbell step" value={`${formatWeight(s.dumbbellStep)} lb`} onStep={(d) => set({ dumbbellStep: clamp(s.dumbbellStep + d * 2.5, 2.5, 10) })} />
    </Section>
  );
}

export function Settings() {
  const { settings, updateSettings, saveError } = useAppData();
  const set: Update = (patch) => updateSettings({ ...settings, ...patch });
  const props = { s: settings, set };
  return (
    <Screen testId="settings" title="Settings" aside={saveError ? <span className="text-work">{saveError}</span> : <span className="text-faint">Saves automatically</span>}>
      <FocusGroup focusKey="settings" className="settings-scroll -mx-4 min-h-0 flex-1 overflow-y-auto px-4 py-2">
        <WorkoutSection {...props} />
        <StretchSection {...props} />
        <SoundSection {...props} />
        <AnchorsSection {...props} />
        <EquipmentSection {...props} />
        <PlatesSection {...props} />
        <StationsSection {...props} />
        <ProgressionSection {...props} />
      </FocusGroup>
      <div className="mt-6">
        <KeyLegend items={[{ keys: '▲ ▼', label: 'Move' }, { keys: '◀ ▶', label: 'Change' }, { keys: 'OK', label: 'Toggle' }, { keys: 'BACK', label: 'Done' }]} />
      </div>
    </Screen>
  );
}
