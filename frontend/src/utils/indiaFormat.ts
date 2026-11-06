export const INDIA_TIME_ZONE = 'Asia/Kolkata';
export const INDIA_LOCALE = 'en-IN';
export const indiaDateTimeInput = (value: Date | string = new Date()): string => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 16);
};
export const indiaDateInput = (value: Date | string = new Date()): string => indiaDateTimeInput(value).slice(0, 10);
export const indiaTimeInput = (value: Date | string = new Date()): string => indiaDateTimeInput(value).slice(11, 16);
export const indiaInputToISO = (value: string): string => new Date(`${value}:00+05:30`).toISOString();
export const formatIndianNumber = (value: number): string => new Intl.NumberFormat(INDIA_LOCALE).format(value);
