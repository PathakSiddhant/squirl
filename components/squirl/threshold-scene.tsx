'use client';

import { motion, useTransform, type MotionValue } from 'motion/react';

/**
 * The landscape on the threshold.
 *
 * Drawn rather than photographed, and drawn as flat layers so it can be
 * recoloured by the hour without shipping four pictures. The squirrel on the
 * rock is the real mark, placed inside the drawing rather than redrawn: the
 * artwork is the brand, and an approximation of it beside the wordmark would
 * be visibly not-quite-right.
 *
 * The layers travel at different rates under the pointer. That is the whole
 * reason for the parallax: distance is what makes flat shapes read as depth,
 * and it costs nothing because every layer moves on a transform.
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
  const sun = useTransform(pointerX, [0, 1], [-6, 6]);
  const sunLift = useTransform(pointerY, [0, 1], [-4, 4]);
  const far = useTransform(pointerX, [0, 1], [10, -10]);
  const mid = useTransform(pointerX, [0, 1], [20, -20]);
  const near = useTransform(pointerX, [0, 1], [34, -34]);
  const nearLift = useTransform(pointerY, [0, 1], [6, -6]);

  const drift = live ? { x: far } : undefined;

  return (
    <svg
      viewBox="0 0 900 1200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <rect x="-60" y="-60" width="1020" height="1320" fill="var(--scene-sky)" />

      {/* The sun sits behind every ridge, so the ridges cut into it. */}
      <motion.circle
        cx="300"
        cy="812"
        r="104"
        fill="var(--scene-sun)"
        style={live ? { x: sun, y: sunLift } : undefined}
      />

      <motion.g style={drift}>
        <path
          d="M-60,842 C60,786 170,826 280,792 C400,754 500,808 620,776 C730,747 830,790 960,762 L960,1320 L-60,1320 Z"
          fill="var(--scene-far)"
        />
      </motion.g>

      <motion.g style={live ? { x: mid } : undefined}>
        <path
          d="M-60,884 C90,830 210,872 330,846 C470,816 570,868 700,842 C790,824 880,856 960,840 L960,1320 L-60,1320 Z"
          fill="var(--scene-mid)"
        />
      </motion.g>

      {/* The water is a gap between ridges rather than a shape of its own. */}
      <motion.g style={live ? { x: mid } : undefined}>
        <path
          d="M-60,946 C110,918 250,952 380,934 C520,914 640,946 780,930 C860,921 920,938 960,930 L960,1000 C900,992 840,976 760,982 C620,992 520,968 380,984 C250,999 110,974 -60,996 Z"
          fill="var(--scene-water)"
        />
      </motion.g>

      <motion.g style={live ? { x: near, y: nearLift } : undefined}>
        {/* The far bank, then the near headland the squirrel is standing on. */}
        <path
          d="M-60,1000 C120,966 260,1004 420,986 C580,968 720,1000 960,972 L960,1320 L-60,1320 Z"
          fill="var(--scene-near)"
        />
        <path
          d="M960,1044 C860,1012 792,1024 732,1000 C686,982 650,988 614,1012 C570,1042 528,1060 470,1078 L470,1320 L960,1320 Z"
          fill="var(--scene-rock)"
        />

        {/* Sprigs, the one place the scene is allowed the accent. */}
        <g stroke="var(--scene-sprig)" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M804,1180 C804,1128 796,1092 778,1058" />
          <path d="M778,1058 C796,1064 808,1080 810,1102" />
          <path d="M790,1114 C772,1104 760,1088 758,1068" />
          <path d="M800,1146 C818,1138 830,1122 832,1102" />
        </g>

        {/* The mark itself, standing on the headland. */}
        <image
          href="/brand/mark.png"
          x="596"
          y="880"
          width="152"
          height="143"
          preserveAspectRatio="xMidYMax meet"
        />
      </motion.g>

      <g
        stroke="var(--scene-bird)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      >
        <path d="M596,470 C606,462 612,462 620,470" />
        <path d="M620,470 C628,462 634,462 644,470" />
        <path d="M556,524 C564,517 569,517 576,524" />
        <path d="M576,524 C583,517 588,517 596,524" />
        <path d="M648,538 C655,532 659,532 665,538" />
        <path d="M665,538 C671,532 675,532 682,538" />
      </g>
    </svg>
  );
}
