import type { StretchDef } from '../core/stretch/schema.ts';

/**
 * Curated stretch library for the stretch day. Photos come from free-exercise-db's
 * "stretching" category (`freeDbId`); names, cues, sides and positions are our own,
 * checked against each entry's instructions. Anything that needs a partner is left out.
 * Gear-tagged entries stay inert until that gear is on in Settings → Equipment.
 */
const WARM_SEC = 30;
const ROLL_SEC = 45;
const STRAP = [['stretch_strap']] as const satisfies StretchDef['requires'];
const ROLLER = [['foam_roller']] as const satisfies StretchDef['requires'];
const BALL = [['exercise_ball']] as const satisfies StretchDef['requires'];
const BENCH = [['bench.flat']] as const satisfies StretchDef['requires'];

export const STRETCHES: StretchDef[] = [
  // ── Warm-up (dynamic) ─────────────────────────────────────────────────────
  {
    id: 'arm-circles', name: 'Arm Circles', freeDbId: 'Arm_Circles',
    block: 'warm', region: 'shoulders', sides: 'both', position: 'standing', durationSec: WARM_SEC,
    requires: [], family: 'arm-circles', muscles: { primary: ['front-delts', 'side-delts'], secondary: ['rear-delts'] },
    cues: ['Arms out at shoulder height', 'Small circles, growing bigger', 'Reverse halfway through'],
  },
  {
    id: 'shoulder-rolls', name: 'Shoulder Rolls', freeDbId: 'Shoulder_Circles',
    block: 'warm', region: 'shoulders', sides: 'both', position: 'standing', durationSec: WARM_SEC,
    requires: [], family: 'shoulder-rolls', muscles: { primary: ['traps'], secondary: ['front-delts', 'rear-delts'] },
    cues: ['Arms loose at your sides', 'Roll forward, up, back, down', 'Reverse halfway through'],
  },
  {
    id: 'chest-opener-swings', name: 'Chest Opener Swings', freeDbId: 'Dynamic_Chest_Stretch',
    block: 'warm', region: 'chest', sides: 'both', position: 'standing', durationSec: WARM_SEC,
    requires: [], family: 'chest-opener-swings', muscles: { primary: ['chest'], secondary: ['front-delts'] },
    cues: ['Arms straight out in front', 'Swing them back, open the chest', 'Controlled, not violent'],
  },
  {
    id: 'elbow-circles', name: 'Elbow Circles', freeDbId: 'Elbow_Circles',
    block: 'warm', region: 'shoulders', sides: 'both', position: 'standing', durationSec: WARM_SEC,
    requires: [], family: 'elbow-circles', muscles: { primary: ['side-delts'], secondary: ['rear-delts', 'traps'] },
    cues: ['Fingertips on your shoulders', 'Draw big circles with the elbows', 'Reverse halfway through'],
  },
  {
    id: 'leg-swings', name: 'Leg Swings', freeDbId: 'Front_Leg_Raises',
    block: 'warm', region: 'hamstrings', sides: 'each', position: 'standing', durationSec: WARM_SEC,
    requires: [], family: 'leg-swings', muscles: { primary: ['hamstrings'], secondary: ['glutes', 'quads'] },
    cues: ['Hold the rack for balance', 'Swing forward and back', 'Leg straight, grow the range'],
  },
  {
    id: 'hip-circles', name: 'Standing Hip Circles', freeDbId: 'Standing_Hip_Circles',
    block: 'warm', region: 'glutes', sides: 'each', position: 'standing', durationSec: WARM_SEC,
    requires: [], family: 'hip-circles', muscles: { primary: ['glutes'], secondary: ['adductors'] },
    cues: ['Hold the rack for balance', 'Knee up to hip height', 'Draw big, slow circles'],
  },
  {
    id: 'worlds-greatest', name: 'World’s Greatest Stretch', freeDbId: 'Worlds_Greatest_Stretch',
    block: 'warm', region: 'full-body', sides: 'each', position: 'kneeling', durationSec: WARM_SEC,
    requires: [], family: 'worlds-greatest', muscles: { primary: ['hamstrings', 'glutes'], secondary: ['quads', 'upper-back'] },
    cues: ['Deep lunge, back knee down', 'Elbow to instep, then reach up', 'Straighten front leg, then back'],
  },
  {
    id: 'inchworm', name: 'Inchworm', freeDbId: 'Inchworm',
    block: 'warm', region: 'full-body', sides: 'both', position: 'standing', durationSec: 40,
    requires: [], family: 'inchworm', muscles: { primary: ['hamstrings'], secondary: ['abs', 'front-delts'] },
    cues: ['Hands down, legs straight', 'Walk out to a plank', 'Walk the feet up to the hands'],
  },
  {
    id: 'cat-cow', name: 'Cat-Cow', freeDbId: 'Cat_Stretch',
    block: 'warm', region: 'back', sides: 'both', position: 'kneeling', durationSec: WARM_SEC,
    requires: [], family: 'cat-cow', muscles: { primary: ['lower-back'], secondary: ['upper-back', 'abs'] },
    cues: ['On hands and knees', 'Round the back, head drops', 'Then arch gently, chest forward'],
  },
  // ── Foam rolling ──────────────────────────────────────────────────────────
  {
    id: 'roll-quads', name: 'Foam Roll Quads', freeDbId: 'Quadriceps-SMR',
    block: 'roll', region: 'quads', sides: 'each', position: 'lying', durationSec: ROLL_SEC,
    requires: [...ROLLER], family: 'roll-quads', muscles: { primary: ['quads'], secondary: [] },
    cues: ['Face down, roller under thigh', 'Roll hip to just above knee', 'Pause on tight spots'],
  },
  {
    id: 'roll-it-band', name: 'Foam Roll IT Band', freeDbId: 'Iliotibial_Tract-SMR',
    block: 'roll', region: 'quads', sides: 'each', position: 'lying', durationSec: ROLL_SEC,
    requires: [...ROLLER], family: 'roll-it-band', muscles: { primary: ['quads'], secondary: ['glutes'] },
    cues: ['On your side, roller at the hip', 'Top foot down to take weight', 'Roll hip toward knee, slowly'],
  },
  {
    id: 'roll-calves', name: 'Foam Roll Calves', freeDbId: 'Calves-SMR',
    block: 'roll', region: 'calves', sides: 'each', position: 'seated', durationSec: ROLL_SEC,
    requires: [...ROLLER], family: 'roll-calves', muscles: { primary: ['calves'], secondary: [] },
    cues: ['Sit, roller under lower leg', 'Stack the other leg on top', 'Roll ankle to knee'],
  },
  {
    id: 'roll-hamstrings', name: 'Foam Roll Hamstrings', freeDbId: 'Hamstring-SMR',
    block: 'roll', region: 'hamstrings', sides: 'both', position: 'seated', durationSec: ROLL_SEC,
    requires: [...ROLLER], family: 'roll-hamstrings', muscles: { primary: ['hamstrings'], secondary: [] },
    cues: ['Roller under both thighs', 'Hands behind you, lift hips', 'Roll from glutes to knees'],
  },
  {
    id: 'roll-glutes', name: 'Foam Roll Glutes', freeDbId: 'Piriformis-SMR',
    block: 'roll', region: 'glutes', sides: 'each', position: 'seated', durationSec: ROLL_SEC,
    requires: [...ROLLER], family: 'roll-glutes', muscles: { primary: ['glutes'], secondary: [] },
    cues: ['Sit on the roller', 'Cross ankle over knee', 'Lean into the crossed side'],
  },
  {
    id: 'roll-adductors', name: 'Foam Roll Inner Thigh', freeDbId: 'Adductor',
    block: 'roll', region: 'adductors', sides: 'each', position: 'lying', durationSec: ROLL_SEC,
    requires: [...ROLLER], family: 'roll-adductors', muscles: { primary: ['adductors'], secondary: [] },
    cues: ['Face down, leg out to the side', 'Roller under the inner thigh', 'Roll groin to knee, slowly'],
  },
  {
    id: 'roll-upper-back', name: 'Foam Roll Upper Back', freeDbId: 'Rhomboids-SMR',
    block: 'roll', region: 'back', sides: 'both', position: 'lying', durationSec: ROLL_SEC,
    requires: [...ROLLER], family: 'roll-upper-back', muscles: { primary: ['upper-back'], secondary: ['traps'] },
    cues: ['Roller under upper back', 'Hug yourself, hips up', 'Roll mid-back to shoulders'],
  },
  {
    id: 'roll-lats', name: 'Foam Roll Lats', freeDbId: 'Latissimus_Dorsi-SMR',
    block: 'roll', region: 'lats', sides: 'each', position: 'lying', durationSec: ROLL_SEC,
    requires: [...ROLLER], family: 'roll-lats', muscles: { primary: ['lats'], secondary: [] },
    cues: ['On your side, roller at armpit', 'Arm overhead, thumb up', 'Roll armpit to mid-back'],
  },
  // ── Hip flexors ───────────────────────────────────────────────────────────
  {
    id: 'kneeling-hip-flexor', name: 'Kneeling Hip Flexor Stretch', freeDbId: 'Kneeling_Hip_Flexor',
    block: 'stretch', region: 'hip-flexors', sides: 'each', position: 'kneeling',
    requires: [], family: 'kneeling-hip-flexor', muscles: { primary: ['quads'], secondary: ['abs'] },
    cues: ['Back knee down on the mat', 'Squeeze the glute, tuck pelvis', 'Shift hips forward gently'],
  },
  {
    id: 'standing-hip-flexor', name: 'Standing Hip Flexor Stretch', freeDbId: 'Standing_Hip_Flexors',
    block: 'stretch', region: 'hip-flexors', sides: 'each', position: 'standing',
    requires: [], family: 'standing-hip-flexor', muscles: { primary: ['quads'], secondary: ['abs'] },
    cues: ['Short staggered stance', 'Back heel up, tuck the pelvis', 'Press the back hip forward'],
  },
  {
    id: 'strap-hip-quad', name: 'Strap Hip Flexor & Quad', freeDbId: 'Intermediate_Hip_Flexor_and_Quad_Stretch',
    block: 'stretch', region: 'hip-flexors', sides: 'each', position: 'lying',
    requires: [...STRAP], family: 'strap-hip-quad', muscles: { primary: ['quads'], secondary: ['abs'] },
    cues: ['Face down, strap around foot', 'Pull the heel toward the glute', 'Let the knee lift off the mat'],
  },
  // ── Hamstrings ────────────────────────────────────────────────────────────
  {
    id: 'seated-hamstring', name: 'Seated Hamstring Stretch', freeDbId: 'Seated_Floor_Hamstring_Stretch',
    block: 'stretch', region: 'hamstrings', sides: 'each', position: 'seated',
    requires: [], family: 'seated-hamstring', muscles: { primary: ['hamstrings'], secondary: ['lower-back'] },
    cues: ['One leg out, other foot in', 'Hinge forward from the hips', 'Reach toward the ankle'],
  },
  {
    id: 'leg-up-hamstring', name: 'Lying Leg-Up Hamstring', freeDbId: 'Leg-Up_Hamstring_Stretch',
    block: 'stretch', region: 'hamstrings', sides: 'each', position: 'lying',
    requires: [], family: 'leg-up-hamstring', muscles: { primary: ['hamstrings'], secondary: ['calves'] },
    cues: ['On your back, other foot flat', 'Raise leg, sole to the ceiling', 'Hands behind thigh, ease in'],
  },
  {
    id: 'strap-hamstring', name: 'Strap Hamstring Stretch', freeDbId: 'Hamstring_Stretch',
    block: 'stretch', region: 'hamstrings', sides: 'each', position: 'lying',
    requires: [...STRAP], family: 'strap-hamstring', muscles: { primary: ['hamstrings'], secondary: ['calves'] },
    cues: ['Strap over the ball of the foot', 'Leg straight up to the ceiling', 'Pull gently, knee straight'],
  },
  {
    id: 'runners-stretch', name: 'Runner’s Stretch', freeDbId: 'Runners_Stretch',
    block: 'stretch', region: 'hamstrings', sides: 'each', position: 'kneeling',
    requires: [], family: 'runners-stretch', muscles: { primary: ['hamstrings'], secondary: ['calves'] },
    cues: ['Hands either side of front foot', 'Front heel stays down', 'Ease hips back to straighten'],
  },
  {
    id: 'hamstring-90-90', name: '90/90 Hamstring Stretch', freeDbId: '90_90_Hamstring',
    block: 'stretch', region: 'hamstrings', sides: 'each', position: 'lying',
    requires: [], family: 'hamstring-90-90', muscles: { primary: ['hamstrings'], secondary: [] },
    cues: ['On your back, hip and knee at 90°', 'Hold behind the thigh', 'Straighten the knee to a stretch'],
  },
  {
    id: 'strap-standing-hamstring', name: 'Standing Hamstring & Calf', freeDbId: 'Standing_Hamstring_and_Calf_Stretch',
    block: 'stretch', region: 'hamstrings', sides: 'each', position: 'standing',
    requires: [...STRAP], family: 'standing-hamstring-calf', muscles: { primary: ['hamstrings'], secondary: ['calves'] },
    cues: ['Strap around the front foot', 'Front leg straight, toes up', 'Lean forward from the hips'],
  },
  // ── Glutes ────────────────────────────────────────────────────────────────
  {
    id: 'figure-four', name: 'Lying Figure-4 Stretch', freeDbId: 'Ankle_On_The_Knee',
    block: 'stretch', region: 'glutes', sides: 'each', position: 'lying',
    requires: [], family: 'figure-four', muscles: { primary: ['glutes'], secondary: [] },
    cues: ['On your back, ankle over knee', 'Pull both legs toward the chest', 'Relax neck and shoulders'],
  },
  {
    id: 'knee-across-body', name: 'Knee Across the Body', freeDbId: 'Knee_Across_The_Body',
    block: 'stretch', region: 'glutes', sides: 'each', position: 'lying',
    requires: [], family: 'knee-across-body', muscles: { primary: ['glutes'], secondary: ['lower-back', 'obliques'] },
    cues: ['On your back, one leg straight', 'Drop the bent knee across', 'Shoulders stay on the floor'],
  },
  {
    id: 'knee-to-chest', name: 'Single Knee to Chest', freeDbId: 'One_Knee_To_Chest',
    block: 'stretch', region: 'glutes', sides: 'each', position: 'lying',
    requires: [], family: 'knee-hug', muscles: { primary: ['glutes'], secondary: ['lower-back'] },
    cues: ['On your back, one leg straight', 'Hug the other knee to chest', 'Hands under the knee'],
  },
  {
    id: 'strap-it-band-glute', name: 'Strap IT Band & Glute', freeDbId: 'IT_Band_and_Glute_Stretch',
    block: 'stretch', region: 'glutes', sides: 'each', position: 'lying',
    requires: [...STRAP], family: 'strap-it-band-glute', muscles: { primary: ['glutes'], secondary: ['quads'] },
    cues: ['Strap around foot, leg straight', 'Swing the leg across your body', 'Shoulders flat, ease it over'],
  },
  // ── Chest ─────────────────────────────────────────────────────────────────
  {
    id: 'stick-chest-opener', name: 'Stick Chest Opener', freeDbId: 'Chest_And_Front_Of_Shoulder_Stretch',
    block: 'stretch', region: 'chest', sides: 'both', position: 'standing',
    requires: [['stretch_stick']], family: 'stick-chest-opener', muscles: { primary: ['chest', 'front-delts'], secondary: [] },
    cues: ['Wide grip on the stick', 'Lift it up and back slowly', 'Only as far as is comfortable'],
  },
  {
    id: 'elbows-back', name: 'Elbows Back Chest Stretch', freeDbId: 'Elbows_Back',
    block: 'stretch', region: 'chest', sides: 'both', position: 'standing',
    requires: [], family: 'elbows-back', muscles: { primary: ['chest'], secondary: ['front-delts'] },
    cues: ['Hands on your lower back', 'Draw the elbows back together', 'Chest tall, chin level'],
  },
  {
    id: 'ball-chest', name: 'Ball Chest Stretch', freeDbId: 'Chest_Stretch_on_Stability_Ball',
    block: 'stretch', region: 'chest', sides: 'each', position: 'kneeling',
    requires: [...BALL], family: 'ball-chest', muscles: { primary: ['chest'], secondary: ['front-delts'] },
    cues: ['Kneel beside the ball', 'Elbow on the ball, arm out wide', 'Sink the chest toward the floor'],
  },
  // ── Lats ──────────────────────────────────────────────────────────────────
  {
    id: 'wall-lat', name: 'Wall Lat Stretch', freeDbId: 'One_Arm_Against_Wall',
    block: 'stretch', region: 'lats', sides: 'each', position: 'standing',
    requires: [], family: 'wall-lat', muscles: { primary: ['lats'], secondary: ['triceps'] },
    cues: ['Bent arm high on the wall', 'Lean in until the lats stretch', 'Let the hips drift back'],
  },
  {
    id: 'standing-side-bend', name: 'Standing Side Bend', freeDbId: 'Standing_Lateral_Stretch',
    block: 'stretch', region: 'lats', sides: 'each', position: 'standing',
    requires: [], family: 'standing-side-bend', muscles: { primary: ['lats', 'obliques'], secondary: [] },
    cues: ['Feet wide, knees soft', 'One hand on hip, other arm up', 'Reach up and over'],
  },
  {
    id: 'side-lying-lat', name: 'Side-Lying Lat Stretch', freeDbId: 'Side-Lying_Floor_Stretch',
    block: 'stretch', region: 'lats', sides: 'each', position: 'lying',
    requires: [], family: 'side-lying-lat', muscles: { primary: ['lats'], secondary: ['obliques'] },
    cues: ['On your side, bottom knee bent', 'Top leg long behind you', 'Reach the top arm overhead'],
  },
  // ── Quads ─────────────────────────────────────────────────────────────────
  {
    id: 'all-fours-quad', name: 'All-Fours Quad Stretch', freeDbId: 'All_Fours_Quad_Stretch',
    block: 'stretch', region: 'quads', sides: 'each', position: 'kneeling',
    requires: [], family: 'all-fours-quad', muscles: { primary: ['quads'], secondary: [] },
    cues: ['On hands and knees', 'Reach back, hold the foot', 'Pull the heel toward the glute'],
  },
  {
    id: 'side-lying-quad', name: 'Side-Lying Quad Stretch', freeDbId: 'On_Your_Side_Quad_Stretch',
    block: 'stretch', region: 'quads', sides: 'each', position: 'lying',
    requires: [], family: 'side-lying-quad', muscles: { primary: ['quads'], secondary: [] },
    cues: ['On your side, bottom knee forward', 'Hold the top foot behind you', 'Push the hip forward gently'],
  },
  {
    id: 'bench-quad', name: 'Bench Quad Stretch', freeDbId: 'Standing_Elevated_Quad_Stretch',
    block: 'stretch', region: 'quads', sides: 'each', position: 'standing',
    requires: [...BENCH], family: 'bench-quad', muscles: { primary: ['quads'], secondary: [] },
    cues: ['Stand with your back to the bench', 'Rest one foot on it behind you', 'Tuck pelvis, sink a little'],
  },
  {
    id: 'strap-quad', name: 'Strap Quad Stretch', freeDbId: 'Quad_Stretch',
    block: 'stretch', region: 'quads', sides: 'each', position: 'lying',
    requires: [...STRAP], family: 'strap-quad', muscles: { primary: ['quads'], secondary: [] },
    cues: ['On your side, strap on top foot', 'Pull the heel toward the glute', 'Let the knee drift back'],
  },
  // ── Calves ────────────────────────────────────────────────────────────────
  {
    id: 'wall-calf', name: 'Wall Calf Stretch', freeDbId: 'Calf_Stretch_Hands_Against_Wall',
    block: 'stretch', region: 'calves', sides: 'each', position: 'standing',
    requires: [], family: 'wall-calf', muscles: { primary: ['calves'], secondary: [] },
    cues: ['Hands on the wall', 'Back leg straight, heel down', 'Lean in from the ankles'],
  },
  {
    id: 'toe-pull-calf', name: 'Toe-Pull Calf Stretch', freeDbId: 'Standing_Gastrocnemius_Calf_Stretch',
    block: 'stretch', region: 'calves', sides: 'each', position: 'standing',
    requires: [], family: 'toe-pull-calf', muscles: { primary: ['calves'], secondary: ['hamstrings'] },
    cues: ['Heel up on a plate or step', 'Knee straight, lean forward', 'Reach for your toes'],
  },
  {
    id: 'soleus-stretch', name: 'Soleus & Achilles Stretch', freeDbId: 'Standing_Soleus_And_Achilles_Stretch',
    block: 'stretch', region: 'calves', sides: 'each', position: 'standing',
    requires: [], family: 'soleus-stretch', muscles: { primary: ['calves'], secondary: [] },
    cues: ['Short staggered stance', 'Bend both knees', 'Back heel stays down'],
  },
  {
    id: 'seated-calf', name: 'Seated Calf Stretch', freeDbId: 'Seated_Calf_Stretch',
    block: 'stretch', region: 'calves', sides: 'each', position: 'seated',
    requires: [], family: 'seated-calf', muscles: { primary: ['calves'], secondary: ['hamstrings'] },
    cues: ['Sit tall, one leg straight', 'Loop a towel or grab the toes', 'Pull the toes toward you'],
  },
  // ── Inner thighs ──────────────────────────────────────────────────────────
  {
    id: 'side-lying-groin', name: 'Side-Lying Groin Stretch', freeDbId: 'Side_Lying_Groin_Stretch',
    block: 'stretch', region: 'adductors', sides: 'each', position: 'lying',
    requires: [], family: 'side-lying-groin', muscles: { primary: ['adductors'], secondary: [] },
    cues: ['On your side, bottom knee bent', 'Lift the top leg, hold the knee', 'Pull it up and back gently'],
  },
  {
    id: 'straddle', name: 'Seated Straddle', freeDbId: 'The_Straddle',
    block: 'stretch', region: 'adductors', sides: 'both', position: 'seated',
    requires: [], family: 'straddle', muscles: { primary: ['adductors', 'hamstrings'], secondary: [] },
    cues: ['Sit tall, legs wide in a V', 'Hands on the floor', 'Walk the hands forward slowly'],
  },
  {
    id: 'butterfly', name: 'Butterfly Stretch', freeDbId: 'Groin_and_Back_Stretch',
    block: 'stretch', region: 'adductors', sides: 'both', position: 'seated',
    requires: [], family: 'butterfly', muscles: { primary: ['adductors'], secondary: ['lower-back'] },
    cues: ['Soles together, knees out', 'Elbows inside the thighs', 'Curl down, press knees gently'],
  },
  // ── Shoulders ─────────────────────────────────────────────────────────────
  {
    id: 'cross-body-shoulder', name: 'Cross-Body Shoulder Stretch', freeDbId: 'Shoulder_Stretch',
    block: 'stretch', region: 'shoulders', sides: 'each', position: 'standing',
    requires: [], family: 'cross-body-shoulder', muscles: { primary: ['rear-delts'], secondary: ['upper-back'] },
    cues: ['Arm straight across the chest', 'Pull it in above the elbow', 'Keep the shoulder down'],
  },
  {
    id: 'overhead-triceps', name: 'Overhead Triceps Stretch', freeDbId: 'Triceps_Stretch',
    block: 'stretch', region: 'shoulders', sides: 'each', position: 'standing',
    requires: [], family: 'overhead-triceps', muscles: { primary: ['triceps'], secondary: ['lats'] },
    cues: ['Hand behind your head', 'Other hand on the elbow', 'Ease the elbow back'],
  },
  // ── Back ──────────────────────────────────────────────────────────────────
  {
    id: 'upper-back-reach', name: 'Upper Back Reach', freeDbId: 'Upper_Back_Stretch',
    block: 'stretch', region: 'back', sides: 'both', position: 'standing',
    requires: [], family: 'upper-back-reach', muscles: { primary: ['upper-back'], secondary: ['rear-delts'] },
    cues: ['Clasp hands, thumbs down', 'Reach forward, round the back', 'Spread the shoulder blades'],
  },
  {
    id: 'standing-twist', name: 'Standing Twist', freeDbId: 'Middle_Back_Stretch',
    block: 'stretch', region: 'back', sides: 'each', position: 'standing',
    requires: [], family: 'twist', muscles: { primary: ['obliques'], secondary: ['lower-back'] },
    cues: ['Feet shoulder width apart', 'Hands on your hips', 'Twist at the waist, hips still'],
  },
  {
    id: 'bench-twist', name: 'Seated Bench Twist', freeDbId: 'Spinal_Stretch',
    block: 'stretch', region: 'back', sides: 'each', position: 'seated',
    requires: [...BENCH], family: 'twist', muscles: { primary: ['obliques'], secondary: ['upper-back'] },
    cues: ['Sit tall on the bench', 'Hands behind head, elbows out', 'Rotate the upper body'],
  },
  {
    id: 'ball-hug', name: 'Ball Hug Back Stretch', freeDbId: 'Hug_A_Ball',
    block: 'stretch', region: 'back', sides: 'both', position: 'seated',
    requires: [...BALL], family: 'ball-hug', muscles: { primary: ['lower-back'], secondary: ['adductors'] },
    cues: ['Straddle the ball, sit low', 'Hug it and round your back', 'Breathe into the low back'],
  },
  // ── Neck ──────────────────────────────────────────────────────────────────
  {
    id: 'side-neck', name: 'Side Neck Stretch', freeDbId: 'Side_Neck_Stretch',
    block: 'stretch', region: 'neck', sides: 'each', position: 'seated',
    requires: [], family: 'side-neck', muscles: { primary: ['traps'], secondary: [] },
    cues: ['Shoulders relaxed', 'Ear toward the shoulder', 'Light pull with the hand'],
  },
  {
    id: 'chin-to-chest', name: 'Chin to Chest Stretch', freeDbId: 'Chin_To_Chest_Stretch',
    block: 'stretch', region: 'neck', sides: 'both', position: 'seated',
    requires: [], family: 'chin-to-chest', muscles: { primary: ['traps'], secondary: ['upper-back'] },
    cues: ['Hands behind your head', 'Let the chin sink to the chest', 'Gentle, no bouncing'],
  },
  // ── Relax (always last) ───────────────────────────────────────────────────
  {
    id: 'childs-pose', name: 'Child’s Pose', freeDbId: 'Childs_Pose',
    block: 'stretch', region: 'back', sides: 'both', position: 'kneeling',
    requires: [], family: 'childs-pose', muscles: { primary: ['lower-back'], secondary: ['lats', 'glutes'] },
    cues: ['Knees wide, sit back on heels', 'Arms long on the floor', 'Breathe slow and deep'],
  },
  {
    id: 'knees-to-chest', name: 'Knees to Chest', freeDbId: 'Hug_Knees_To_Chest',
    block: 'stretch', region: 'back', sides: 'both', position: 'lying',
    requires: [], family: 'knee-hug', muscles: { primary: ['lower-back'], secondary: ['glutes'] },
    cues: ['On your back', 'Hug both knees in', 'Hands under the knees'],
  },
];
