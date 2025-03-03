import React from "react";
import { LayoutRectangle } from "react-native";

import PagerView from "react-native-pager-view";
import Reanimated from "react-native-reanimated";

import { ScrollViewProps } from "design-system/scroll-view";

export type TabRootProps = {
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  tabListHeight?: number;
  children: React.ReactNode;
  lazy?: boolean;
  accessibilityLabel?: string;
  index?: number;
};

export type TabListProps = ScrollViewProps & {
  onPressCallback?: () => void;
};

export interface ExtendObject extends Object {
  minHeight?: number;
}

export type TabsContextType = {
  tabListHeight: number;
  index: Reanimated.SharedValue<number>;
  tabItemLayouts: Array<Reanimated.SharedValue<LayoutRectangle | null>>;
  requestOtherViewsToSyncTheirScrollPosition: Reanimated.SharedValue<boolean>;
  translateY: Reanimated.SharedValue<number>;
  offset: Reanimated.SharedValue<number>;
  position: Reanimated.SharedValue<number>;
  headerHeight: number;
  initialIndex: number;
  onIndexChange: (index: number) => void;
  pagerRef: React.RefObject<PagerView>;
  lazy?: boolean;
};
