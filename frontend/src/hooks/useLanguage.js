import { useSyncExternalStore } from 'react';
import { getLanguage, setLanguage, subscribeLanguage, translate } from '../lib/locale';

export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  return { language, setLanguage, t: translate };
}
