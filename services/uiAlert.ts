export const showUiAlert = (message: string) => {
  if (typeof window === 'undefined') return;
  window.alert(message);
};
