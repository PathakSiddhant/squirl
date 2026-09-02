'use client';

import { motion, useTransform, type MotionValue } from 'motion/react';

/**
 * The landscape on the threshold.
 *
 * Drawn rather than photographed, and drawn as flat layers so it can be
 * recoloured by the hour without shipping four pictures of it. The squirrel on
 * the rock is the real mark placed inside the drawing: the artwork is the
 * brand, and an approximation of it sitting under the wordmark would be
 * visibly not-quite-right.
 *
 * The layers travel at different rates under the pointer. That is the whole
 * reason for the parallax: distance is what makes flat shapes read as depth,
 * and it costs nothing, because every layer moves on a transform.
 *
 * Everything sits below y=620 in the viewBox. The headline lives in the sky
 * above that, and the composition has to leave it clear at every window size.
 */
export function ThresholdScene({
  pointerX,
  pointerY,
  live,
}: {
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  live: boolean;
}) {
  // Further away means slower, which is the only rule that matters here.
  const sun = useTransform(pointerX, [0, 1], [-5, 5]);
  const sunLift = useTransform(pointerY, [0, 1], [-4, 4]);
  const far = useTransform(pointerX, [0, 1], [9, -9]);
  const mid = useTransform(pointerX, [0, 1], [17, -17]);
  const water = useTransform(pointerX, [0, 1], [24, -24]);
  const near = useTransform(pointerX, [0, 1], [34, -34]);
  const nearLift = useTransform(pointerY, [0, 1], [6, -6]);

  return (
    <svg
      viewBox="0 0 900 1200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        {/* The tooth of the paper. Without it the flat fills read as plastic. */}
        <filter id="scene-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
        </filter>
      </defs>

      <rect x="-60" y="-60" width="1020" height="1320" fill="var(--scene-sky)" />

      {/* The sun sits behind every ridge, so the ridges cut into it. */}
      <motion.circle
        cx="452"
        cy="742"
        r="136"
        fill="var(--scene-sun)"
        style={live ? { x: sun, y: sunLift } : undefined}
      />

      <motion.g style={live ? { x: far } : undefined}>
        <path
          d="M-60,806 C40,764 120,780 208,764 C300,747 356,700 452,704 C548,708 604,752 700,768 C790,783 870,772 960,748 L960,1320 L-60,1320 Z"
          fill="var(--scene-far)"
        />
      </motion.g>

      <motion.g style={live ? { x: mid } : undefined}>
        <path
          d="M-60,884 C60,846 150,868 250,846 C356,822 420,780 520,792 C620,804 682,846 780,858 C850,867 910,860 960,846 L960,1320 L-60,1320 Z"
          fill="var(--scene-mid)"
        />
        <path
          d="M-60,952 C80,922 190,944 300,924 C410,904 470,880 560,892 C660,905 740,936 830,942 C890,946 930,940 960,932 L960,1320 L-60,1320 Z"
          fill="var(--scene-ridge)"
        />
      </motion.g>

      {/* A band of water between the ridges, read end on rather than drawn as
          a river running towards you. A tapering channel needs its two banks
          to agree with it exactly, and hand-authored curves that nearly agree
          look like a mistake rather than a shape. */}
      <motion.g style={live ? { x: water } : undefined}>
        <path
          d="M-60,1000 C110,972 250,1004 390,986 C530,968 650,998 790,984 C870,976 920,992 960,984 L960,1050 C900,1042 840,1028 760,1034 C620,1044 520,1020 380,1036 C250,1050 110,1026 -60,1046 Z"
          fill="var(--scene-water)"
        />
      </motion.g>

      <motion.g style={live ? { x: near, y: nearLift } : undefined}>
        {/* The two banks, drawn either side of the river rather than as one
            shape with a hole cut in it. */}
        <path
          d="M-60,1004 C120,970 280,1000 440,984 C600,968 760,996 960,972 L960,1320 L-60,1320 Z"
          fill="var(--scene-near)"
        />
        <path
          d="M-60,1046 C46,1004 148,992 232,1026 C298,1053 340,1102 362,1150 L362,1200 L-60,1200 Z"
          fill="var(--scene-rock)"
        />

        {/* Sprigs and grass, the one place the scene is allowed the accent. */}
        <g stroke="var(--scene-sprig)" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M292,1200 C292,1146 300,1110 318,1076" />
          <path d="M318,1076 C300,1082 288,1098 286,1118" />
          <path d="M306,1128 C324,1118 336,1102 338,1082" />
          <path d="M298,1160 C280,1152 268,1136 266,1116" />
        </g>
        <g stroke="var(--scene-grass)" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.75">
          <path d="M556,1200 C556,1162 550,1140 538,1120" />
          <path d="M568,1200 C570,1168 578,1148 590,1132" />
          <path d="M544,1200 C540,1172 532,1154 520,1140" />
        </g>

        {/* The mark itself, standing on the rock. */}
        <image
          href="/brand/mark.png"
          x="62"
          y="856"
          width="170"
          height="160"
          preserveAspectRatio="xMidYMax meet"
        />
      </motion.g>

      <g
        stroke="var(--scene-bird)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      >
        <path d="M596,470 C606,462 612,462 620,470" />
        <path d="M620,470 C628,462 634,462 644,470" />
        <path d="M556,524 C564,517 569,517 576,524" />
        <path d="M576,524 C583,517 588,517 596,524" />
        <path d="M648,538 C655,532 659,532 665,538" />
        <path d="M665,538 C671,532 675,532 682,538" />
      </g>

      <rect
        x="-60"
        y="-60"
        width="1020"
        height="1320"
        filter="url(#scene-grain)"
        opacity="0.055"
        style={{ mixBlendMode: 'multiply' }}
      />
    </svg>
  );
}
