const TZ = 'Asia/Bangkok';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function fmtDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${timeFmt.format(new Date(iso))}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const days = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000;
  return Math.round(days * 10) / 10;
}
