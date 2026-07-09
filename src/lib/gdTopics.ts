export const GD_TOPIC_LABELS: Record<string, string> = {
  'ai-in-education': 'AI in education',
  'social-media': 'Social media and students',
  'startup-india': 'Startups in India',
  'remote-work': 'Remote work culture',
  'climate-action': 'Climate responsibility',
  'digital-payments': 'Digital payments',
};

export function labelGdTopic(topic: string): string {
  return GD_TOPIC_LABELS[topic] ?? topic;
}
