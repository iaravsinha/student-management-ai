import { AxiosError } from "axios";

export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const formatLabel = (value: string) =>
  value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(`1970-01-01T${value}`));

export const getLocalDateInputValue = (value = new Date()) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const addMinutesToTime = (timeValue: string, minutes: number) => {
  const [hours, mins] = timeValue.split(":").map(Number);
  const totalMinutes = (hours * 60 + mins + minutes) % (24 * 60);
  const nextHours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const nextMinutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${nextHours}:${nextMinutes}:00`;
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (typeof item?.msg === "string" ? item.msg : null))
        .filter(Boolean)
        .join(", ");
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

export const cn = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");
