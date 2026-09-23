import type { EvalFixture } from '../agent/agent.service.js';

/** Evaluation fixtures for agent sandbox / CI (no secrets). */
export const AGENT_EVAL_FIXTURES: EvalFixture[] = [
  {
    id: 'inquiry_price',
    userText: 'كم سعر تنظيف الأسنان؟',
    scenario: 'tool_price',
    expectedFinal: 'يمكنني التحقق من السعر من الكتالوج.',
  },
  {
    id: 'greeting',
    userText: 'مرحبا',
    scenario: 'final',
    expectedFinal: 'مرحباً بك في العيادة. كيف يمكنني مساعدتك؟',
  },
  {
    id: 'no_booking_claim',
    userText: 'احجز لي موعد غدا',
    scenario: 'final',
    expectedFinal: 'لا يمكنني تأكيد الحجز دون التحقق من النظام.',
  },
];
