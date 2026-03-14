import { Injectable } from '@nestjs/common';

export interface ScheduleRule {
  enabled?: boolean;
  startTime?: string;
  endTime?: string;
  weekdays?: number[];
}

export interface SceneRulesLike {
  schedule?: ScheduleRule;
}

/**
 * Evaluates scene schedule rules (time window + weekdays).
 * Used by reply flow to decide if a scene is currently "in effect".
 */
@Injectable()
export class SceneSchedulerService {
  /**
   * Returns true if the given rules' schedule is enabled and current UTC time
   * falls within startTime-endTime and current weekday is in weekdays.
   * If schedule is disabled or missing, returns true (no time restriction).
   */
  isWithinSchedule(rules: SceneRulesLike | null | undefined): boolean {
    const schedule = rules?.schedule;
    if (!schedule?.enabled) return true;
    const now = new Date();
    const weekday = now.getUTCDay(); // 0 Sun, 1 Mon, ... 6 Sat
    const weekdays = schedule.weekdays;
    if (weekdays?.length && !weekdays.includes(weekday === 0 ? 7 : weekday)) {
      return false;
    }
    const start = schedule.startTime;
    const end = schedule.endTime;
    if (!start || !end) return true;
    const current = this.toMinutes(now.getUTCHours(), now.getUTCMinutes());
    const startM = this.timeToMinutes(start);
    const endM = this.timeToMinutes(end);
    if (startM <= endM) {
      return current >= startM && current < endM;
    }
    // e.g. 18:00 - 09:00 spans midnight
    return current >= startM || current < endM;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }

  private toMinutes(hours: number, minutes: number): number {
    return hours * 60 + minutes;
  }
}
