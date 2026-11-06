import { useEffect, useState } from 'react';
import api from '../services/api';

interface AiConfig { provider: 'gemini' | 'ollama'; model: string; externalProcessing: boolean }

export const useAiProvider = () => {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api.get<AiConfig>('/ai/config').then(({ data }) => {
      if (active && ['gemini', 'ollama'].includes(data.provider)) setConfig(data);
      else if (active) setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const disclosure = (content: string) => !config
    ? failed ? 'AI settings could not be loaded. Reload this page to try again.' : 'Loading AI privacy settings...'
    : config.externalProcessing
      ? `${content} will be sent to Google Gemini. Use synthetic data only in this demo; free-tier content may be used to improve Google products.`
      : `${content} will be processed by Ollama on the application server, without an external AI provider.`;
  return { ready: Boolean(config), disclosure };
};
