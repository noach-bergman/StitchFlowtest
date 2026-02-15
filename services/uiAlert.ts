export const UI_ALERT_EVENT_NAME = 'stitchflow:ui-alert';

export const showUiAlert = (message: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(UI_ALERT_EVENT_NAME, { detail: message }));
};
