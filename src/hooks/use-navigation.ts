'use client';

import { useNavigationViewModel } from "@/src/features/navigation/viewmodel/useNavigationViewModel";

export function useNavigation() {
  return useNavigationViewModel();
}
