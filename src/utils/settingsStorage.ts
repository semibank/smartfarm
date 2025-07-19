interface DashboardSettings {
  title: string;
  titleColor: string;
  titleEmoji: string;
  backgroundGradient: string;
}

const STORAGE_KEY = 'smartfarm-dashboard-settings';

export const saveDashboardSettings = (settings: DashboardSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving dashboard settings:', error);
  }
};

export const loadDashboardSettings = (): DashboardSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultDashboardSettings();
    }
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading dashboard settings:', error);
    return getDefaultDashboardSettings();
  }
};

const getDefaultDashboardSettings = (): DashboardSettings => {
  return {
    title: '스마트팜 대시보드',
    titleColor: 'white',
    titleEmoji: '🌱',
    backgroundGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  };
};

export const clearDashboardSettings = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing dashboard settings:', error);
  }
};

export type { DashboardSettings };