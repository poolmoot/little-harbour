import { describe, expect, it } from 'vitest';
import { GOALS } from '../sim/config';
import { initialState } from '../sim/sim';
import { goalDoneHtml, goalHtml, rateHtml, weatherHtml } from './hudParts';
import { GOAL_TEXT } from './text';

describe('HUD parts', () => {
  it('shows the first goal with its line and reward, and no progress bar for a one-step goal', () => {
    const h = goalHtml(initialState());
    expect(h).toContain(GOAL_TEXT.send);
    expect(h).toContain(`Goal 1 of ${GOALS.length}`);
    expect(h).toContain(`+${GOALS[0].reward}`);
    expect(h).not.toContain('class="well meter');
  });

  it('shows a count and a bar for a goal with several steps', () => {
    const s = initialState();
    s.goal = GOALS.findIndex((g) => g.id === 'sell100');
    s.tally.sold = 30;
    const h = goalHtml(s);
    expect(h).toContain('30 of 100');
    expect(h).toContain('meter');
  });

  it('says so when every goal is done', () => {
    const s = initialState();
    s.goal = GOALS.length;
    expect(goalHtml(s)).toContain('All goals done!');
  });

  it('flourish shows the reward', () => {
    expect(goalDoneHtml(40)).toContain('Goal done! +$40');
  });

  it('weather chip shows today, tomorrow and the special day', () => {
    const s = initialState();
    s.weather = 'fog';
    s.special = { kind: 'market' };
    s.nextWeather = 'storm';
    const w = weatherHtml(s);
    expect(w.html).toContain('Fog · Market day');
    expect(w.html).toContain('Tomorrow: Storm');
    expect(w.tip).toContain('Tomorrow: Storm');
  });

  it('shows money per minute only when money is coming in', () => {
    const s = initialState();
    expect(rateHtml(s)).toBe('');
    s.incomeLog = [0, 50, 100]; // 100 earned in 10 seconds
    expect(rateHtml(s)).toContain('$600 a minute');
  });
});
