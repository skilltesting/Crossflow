import type { MockNotification } from '../types';
import { genId } from './utils';

// Browsers have no API to read a device's real system notifications — that
// requires OS-level access no web app is granted. This templated generator
// is the honest substitute: it lets you exercise the forwarding pipeline
// (activity feed + cross-device relay over the data channel) end to end.
const TEMPLATES: Array<Omit<MockNotification, 'id'>> = [
  { app: 'Messages', title: 'Priya Sharma', body: 'Are we still on for 6pm?', accent: '#00F0FF' },
  { app: 'Mail', title: 'GitHub', body: 'New review requested on your pull request', accent: '#0066FF' },
  { app: 'Calendar', title: 'Standup in 10 minutes', body: 'Daily sync — Conference Room B', accent: '#10B981' },
  { app: 'Slack', title: '#engineering', body: 'Deploy to production finished ✅', accent: '#0066FF' },
  { app: 'Banking', title: 'Payment received', body: '₹2,400.00 credited to your account', accent: '#10B981' },
  { app: 'Weather', title: 'Rain expected', body: 'Light showers starting around 4 PM', accent: '#00F0FF' },
  { app: 'Music', title: 'Now playing', body: 'Resume this session on your other device?', accent: '#0066FF' },
  { app: 'Fitness', title: 'Goal reached', body: 'You hit your step goal for today 🎉', accent: '#10B981' },
];

export function randomMockNotification(): MockNotification {
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  return { id: genId(), ...template };
}
