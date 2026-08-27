import { QueryClient } from '@tanstack/react-query';
import { IS_API_CONFIGURED } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,  // 2 minutes
      retry: IS_API_CONFIGURED ? 1 : 0,
      refetchOnWindowFocus: false,
      // Don't run any query if backend isn't configured
      enabled: IS_API_CONFIGURED,
    },
  },
});
