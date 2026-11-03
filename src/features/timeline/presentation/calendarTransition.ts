/**
 * カレンダーの月送りで付ける遷移の種類（React の addTransitionType に渡す）。
 * src/styles/globals.css の ::view-transition-* で、この種類のときだけ月をスライドさせる
 */
export const CALENDAR_TRANSITION_TYPE = {
  prev: "calendar-prev",
  next: "calendar-next",
} as const;
