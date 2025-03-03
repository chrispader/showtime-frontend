//@ts-nocheck
import React, {
  ForwardedRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  FlatListProps,
  KeyboardAvoidingView,
  LayoutRectangle,
  Platform,
  Pressable,
  PressableProps,
  RefreshControl,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";

import PagerView from "react-native-pager-view";
import Reanimated, {
  Extrapolate,
  interpolate,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";

import {
  ScrollViewProps,
  ScrollView,
} from "@showtime-xyz/universal.scroll-view";
import { tw } from "@showtime-xyz/universal.tailwind";

import { ViewabilityTrackerFlatlist } from "app/components/viewability-tracker-flatlist";
import { useIsFocused, useScrollToTop } from "app/lib/react-navigation/native";
import { RecyclerListView } from "app/lib/recyclerlistview";
import { flattenChildren } from "app/utilities";

import {
  ExtendObject,
  TabListProps,
  TabRootProps,
  TabsContextType,
} from "./types";
import { usePageScrollHandler } from "./usePagerScrollHandler";

const windowHeight = Dimensions.get("window").height;

const AnimatedPagerView = Reanimated.createAnimatedComponent(PagerView);
const AnimatedScrollView = Reanimated.createAnimatedComponent(ScrollView);

export const TabsContext = React.createContext(
  null as unknown as TabsContextType
);

const Root = ({
  children,
  tabListHeight: initialtabListHeight,
  initialIndex = 0,
  index: indexProp,
  onIndexChange: onIndexChangeProp,
  lazy,
}: TabRootProps) => {
  const pagerRef = React.useRef();
  const index = useSharedValue(initialIndex ?? 0);
  const position = useSharedValue(0);
  const offset = useSharedValue(0);
  const translateY = useSharedValue(0);
  // maybe change this to shared value too
  const [headerHeight, setHeaderHeight] = React.useState(0);
  // maybe change this to shared value too
  const [tabListHeight, setTabListHeight] =
    React.useState(initialtabListHeight);
  const requestOtherViewsToSyncTheirScrollPosition = useSharedValue(false);
  const tabItemLayouts: Array<Reanimated.SharedValue<LayoutRectangle>> = [];

  const onIndexChange = (newIndex) => {
    index.value = newIndex;
    onIndexChangeProp?.(newIndex);
  };

  useEffect(() => {
    if (typeof indexProp === "number") {
      pagerRef.current.setPage(indexProp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexProp]);

  // We need to put both header and TabBar in absolute view so filter here, bad for composition, maybe improve later
  const { tabListChild, restChildren, headerChild } = React.useMemo(() => {
    let tabListChild;
    let restChildren = [];
    let headerChild;
    flattenChildren(children).forEach((c) => {
      if (React.isValidElement(c) && c) {
        //@ts-ignore
        if (c.type === List) {
          tabListChild = c;
          //@ts-ignore
        } else if (c.type === Header) {
          headerChild = c;
        } else {
          restChildren.push(c);
        }
      }
    });
    return { tabListChild, headerChild, restChildren };
  }, [children]);

  const headerTranslateStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  useAnimatedReaction(
    () => {
      return index.value;
    },
    (v, newV) => {
      if (v !== newV) {
        requestOtherViewsToSyncTheirScrollPosition.value = false;
      }
    }
  );

  return (
    <TabsContext.Provider
      value={{
        tabListHeight,
        index,
        tabItemLayouts,
        requestOtherViewsToSyncTheirScrollPosition,
        translateY,
        offset,
        position,
        headerHeight,
        initialIndex,
        onIndexChange,
        pagerRef,
        lazy,
      }}
    >
      <Reanimated.View
        style={[utilStyles.a, headerTranslateStyle]}
        pointerEvents="box-none"
      >
        <View
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
          pointerEvents="box-none"
        >
          {headerChild}
        </View>
        {tabListChild && (
          <View
            style={{ flex: 1 }}
            onLayout={(e) => setTabListHeight(e.nativeEvent.layout.height)}
            pointerEvents="box-none"
          >
            {tabListChild}
          </View>
        )}
      </Reanimated.View>
      {/* mount children only when tabBar and header heights are known */}
      {(headerHeight || !headerChild) && tabListHeight ? restChildren : null}
    </TabsContext.Provider>
  );
};

const List = (props: TabListProps) => {
  let hasTrigger = false;
  // TODO: fix dynamically loading tab items. Currently we load tab items if tab trigger is present
  flattenChildren(props.children).forEach((c) => {
    if (React.isValidElement(c) && c && c.type === Trigger) {
      hasTrigger = true;
    }
  });

  if (hasTrigger) {
    return <ListImpl {...props} />;
  }

  return null;
};

const ListImpl = ({
  children,
  style,
  onPressCallback,
  ...props
}: TabListProps) => {
  const { index, tabItemLayouts } = useContext(TabsContext);
  const tabListRef = useRef<Reanimated.ScrollView>();

  const newChildren = React.useMemo(() => {
    let triggerIndex = -1;

    return flattenChildren(children).map((c) => {
      // @ts-ignore - Todo - do better ts check here
      if (React.isValidElement(c) && c && c.type === Trigger) {
        triggerIndex++;
        // @ts-ignore - Todo - do better ts check here
        return React.cloneElement(c, { index: triggerIndex, onPressCallback });
      } else {
        return c;
      }
    });
  }, [children, onPressCallback]);

  const listWidth = useSharedValue(0);
  const windowWidth = useWindowDimensions().width;
  const prevIndex = useSharedValue(0);

  const scrollTo = (x) => {
    // @ts-ignore getNode will be removed in future, need to update typings
    tabListRef.current?.scrollTo?.({ x });
  };

  useDerivedValue(() => {
    if (prevIndex.value) {
      if (tabItemLayouts[index.value] && tabItemLayouts[index.value].value) {
        const itemLayoutX = tabItemLayouts[index.value].value.x;
        const itemWidth = tabItemLayouts[index.value].value.width;
        runOnJS(scrollTo)(itemLayoutX - windowWidth / 2 + itemWidth / 2);
      }
    }
    prevIndex.value = index.value;
  }, [windowWidth]);

  useScrollToTop(
    React.useRef({
      scrollToTop: () => {
        runOnUI(scrollTo)(0);
      },
    })
  );

  const styles = React.useMemo(() => {
    return [tw.style(`bg-white dark:bg-black`), style];
  }, [style]);

  return (
    <AnimatedScrollView
      onLayout={(e) => {
        listWidth.value = e.nativeEvent.layout.width;
      }}
      bounces={false}
      ref={tabListRef}
      showsHorizontalScrollIndicator={false}
      horizontal
      style={styles}
      {...props}
    >
      {newChildren}
    </AnimatedScrollView>
  );
};

const TabIndexContext = React.createContext({} as { index: number });

const Pager = ({
  children,
  tw,
}: {
  children: React.ReactNode;
  tw?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const {
    initialIndex,
    onIndexChange,
    pagerRef,
    position,
    offset,
    lazy,
    index,
  } = useContext(TabsContext);
  const [mountedIndices, setMountedIndices] = React.useState(
    lazy ? [initialIndex] : flattenChildren(children).map((_c, i) => i)
  );

  const newChildren = React.useMemo(
    () =>
      flattenChildren(children).map((c, i) => {
        const shouldLoad = mountedIndices.includes(i);
        return (
          // why use context if we can clone the children. do we need better composition here?
          <TabIndexContext.Provider value={{ index: i }} key={c.key ?? i}>
            {
              <View
                style={[
                  utilStyles.b,
                  shouldLoad ? StyleSheet.absoluteFill : undefined,
                ]}
              >
                {shouldLoad ? (
                  c.props.useKeyboardAvoidingView ? (
                    <KeyboardAvoidingView
                      style={{ flex: 1 }}
                      behavior="padding"
                      keyboardVerticalOffset={
                        c.props.keyboardVerticalOffset || 0
                      }
                    >
                      {c}
                    </KeyboardAvoidingView>
                  ) : (
                    c
                  )
                ) : null}
              </View>
            }
          </TabIndexContext.Provider>
        );
      }),
    [children, mountedIndices]
  );

  useAnimatedReaction(
    () => {
      return index.value;
    },
    (res, prev) => {
      if (res !== prev && !mountedIndices.includes(res)) {
        runOnJS(setMountedIndices)(mountedIndices.concat(res));
      }
    },
    [mountedIndices]
  );

  const handler = usePageScrollHandler({
    onPageScroll: (e: any) => {
      "worklet";
      offset.value = e.offset;
      position.value = e.position;
    },
  });

  return (
    <AnimatedPagerView
      style={{ flex: 1 }}
      ref={pagerRef}
      // Todo - make this work with reanimated event handlers
      onPageScroll={handler}
      initialPage={initialIndex}
      onPageSelected={(e) => onIndexChange(e.nativeEvent.position)}
      tw={tw}
    >
      {newChildren}
    </AnimatedPagerView>
  );
};

const Content = React.forwardRef(
  ({ style, ...props }: ViewProps, ref: ForwardedRef<View>) => {
    const { headerHeight, tabListHeight } = useContext(TabsContext);
    return (
      <View
        {...props}
        ref={ref}
        style={[style, { paddingTop: headerHeight + tabListHeight }]}
      />
    );
  }
);
Content.displayName = "Content";

const Trigger = React.forwardRef(
  (
    {
      children,
      //@ts-ignore - index will be passed by Pager via context
      index,
      onLayout,
      onPress,
      onPressCallback,
      ...props
    }: PressableProps & {
      onPressCallback?: () => void;
    },
    // eslint-disable-next-line unused-imports/no-unused-vars
    ref: ForwardedRef<typeof Pressable>
  ) => {
    const { pagerRef, tabItemLayouts } = useContext(TabsContext);

    if (typeof index !== "number" && __DEV__) {
      console.error("Make sure you wrap Tabs.Trigger inside Tabs.Pager");
    }

    tabItemLayouts[index] = useSharedValue(null);

    return (
      <Pressable
        onLayout={(e) => {
          tabItemLayouts[index].value = e.nativeEvent.layout;
          onLayout?.(e);
        }}
        onPress={(e) => {
          onPressCallback?.();
          pagerRef.current.setPage(index);
          onPress?.(e);
        }}
        {...props}
      >
        <TabIndexContext.Provider value={{ index }}>
          {children}
        </TabIndexContext.Provider>
      </Pressable>
    );
  }
);
Trigger.displayName = "Trigger";

function useTabScrollViewProps(props: any, ref: any) {
  const {
    headerHeight,
    requestOtherViewsToSyncTheirScrollPosition,
    tabListHeight,
    translateY,
    index,
  } = useContext(TabsContext);
  const elementIndex = React.useContext(TabIndexContext).index;
  const aref = useAnimatedRef<Reanimated.ScrollView>();
  const scrollY = useSharedValue(0);
  const topHeight = headerHeight + tabListHeight;
  const translateYOffset = Platform.OS === "ios" ? topHeight : 0;
  const minHeight = props.minHeight ?? windowHeight + topHeight;

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag() {
      requestOtherViewsToSyncTheirScrollPosition.value = false;
    },
    onMomentumBegin() {
      requestOtherViewsToSyncTheirScrollPosition.value = false;
    },
    onScroll(e) {
      // Todo - this is a hack to make sure we change header when listening current flatlist scrolls. Other flatlist scroll events may be triggered as we try to adjust their scroll positions to accommodate header
      if (index.value === elementIndex) {
        scrollY.value = e.contentOffset.y;
        if (Platform.OS === "ios") {
          translateY.value = interpolate(
            scrollY.value,
            [-translateYOffset, -tabListHeight],
            [0, -headerHeight],
            Extrapolate.CLAMP
          );
        } else {
          translateY.value = interpolate(
            scrollY.value,
            [0, headerHeight],
            [0, -headerHeight],
            Extrapolate.CLAMP
          );
        }
      }
    },
    onEndDrag() {
      requestOtherViewsToSyncTheirScrollPosition.value = true;
    },
    onMomentumEnd() {
      requestOtherViewsToSyncTheirScrollPosition.value = true;
    },
  });

  // sync other flatlist's scroll position if header is translated
  useDerivedValue(() => {
    if (
      index.value !== elementIndex &&
      requestOtherViewsToSyncTheirScrollPosition.value
    ) {
      const absTranslateY = -1 * translateY.value;
      if (
        absTranslateY < headerHeight ||
        scrollY.value + translateYOffset < absTranslateY
      ) {
        scrollTo(aref, 0, absTranslateY - translateYOffset, false);
        // manually set scrollY because onScroll of other lists's won't be triggered
        scrollY.value = absTranslateY - translateYOffset;
      }
    }
  }, [translateYOffset]);

  const _ref = useRef<FlatList>(null);

  useScrollToTop(
    React.useRef({
      scrollToTop: () => {
        runOnUI(scrollTo)(aref, 0, -translateYOffset, true);
      },
    })
  );

  return {
    ...props,
    scrollEventThrottle: 16,
    onScroll: scrollHandler,
    alwaysBounceHorizontal: false,
    automaticallyAdjustContentInsets: false,
    ref: mergeRef([ref, aref, _ref]),
    contentOffset: useMemo(
      () => ({
        y:
          Platform.OS === "ios"
            ? -topHeight + -1 * translateY.value
            : -1 * translateY.value,
      }),
      [topHeight, translateY.value]
    ),
    contentInset: useMemo(
      () => ({
        top: Platform.OS === "ios" ? topHeight : 0,
      }),
      [topHeight]
    ),
    contentContainerStyle: useMemo(
      () => ({
        paddingTop: Platform.OS === "android" ? topHeight : 0,
        minHeight,
      }),
      [topHeight, minHeight]
    ),
    progressViewOffset: topHeight,
  };
}

function makeScrollableComponent<K extends ExtendObject, T extends any>(
  Comp: T
) {
  return React.forwardRef<K, T>(function TabViewScrollable(props, ref) {
    const scrollViewProps = useTabScrollViewProps(props, ref);
    return <Comp {...scrollViewProps} />;
  });
}

const ReanimatedRecyclerList =
  Reanimated.createAnimatedComponent(RecyclerListView);

const TabRecyclerListView = React.memo(
  React.forwardRef((props, ref) => {
    const { onScroll, ...restProps } = useTabScrollViewProps(props, ref);

    const scrollViewProps = useMemo(() => {
      return {
        refreshControl: (
          <RefreshControl
            refreshing={props.refreshing}
            onRefresh={props.onRefresh}
          />
        ),
        ...restProps,
      };
    }, [restProps, props.refreshing, props.onRefresh]);

    return (
      <ReanimatedRecyclerList
        {...props}
        ref={ref}
        onScroll={onScroll}
        scrollViewProps={scrollViewProps}
      />
    );
  })
);

TabRecyclerListView.displayName = "TabRecyclerListView";

type ScrollableScrollViewType = ScrollViewProps & {
  useKeyboardAvoidingView?: boolean;
  keyboardVerticalOffset?: number;
};
const TabScrollView = makeScrollableComponent<
  ScrollViewProps,
  ScrollableScrollViewType
>(AnimatedScrollView);

const AnimatedFlatList = Reanimated.createAnimatedComponent(
  ViewabilityTrackerFlatlist
);

interface ExtendedFlatListProps extends FlatListProps<any> {
  minHeight?: number;
  useKeyboardAvoidingView?: boolean;
  keyboardVerticalOffset?: number;
}
const TabFlatList = makeScrollableComponent<FlatList, ExtendedFlatListProps>(
  AnimatedFlatList
);

const Header = (props) => {
  return props.children;
};

export const Tabs = {
  Root,
  List,
  Pager,
  Trigger,
  View: Content,
  Header,
  ScrollView: TabScrollView,
  FlatList: TabFlatList,
  RecyclerList: TabRecyclerListView,
};

export const useTabsContext = () => {
  const ctx = useContext(TabsContext);

  if (ctx === null) {
    console.error("Make sure useTabsContext is rendered within Tabs.Root");
  }

  return ctx;
};

export const useTabIndexContext = () => {
  const ctx = useContext(TabIndexContext);

  if (ctx === null) {
    console.error(
      "Make sure useTabIndexContext is rendered within Tabs.Trigger"
    );
  }

  return ctx;
};

function mergeRef(refs) {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        ref.current = value;
      }
    });
  };
}

const utilStyles = StyleSheet.create({
  a: { position: "absolute", zIndex: 1, flex: 1 },
  b: {
    flex: 1,
    overflow: "hidden",
  },
});

export const useIsTabFocused = () => {
  const tabsCtx = useContext(TabsContext) ?? { index: { value: undefined } };
  const tabItemCtx = useContext(TabIndexContext);
  const isFocused = useIsFocused();
  const [tabFocused, setTabFocused] = useState(isFocused);

  useAnimatedReaction(
    () => {
      return tabsCtx.index.value;
    },
    (v) => {
      // If item is in a list
      if (typeof tabItemCtx.index === "number") {
        // we check that this list is focused
        if (v === tabItemCtx.index) {
          runOnJS(setTabFocused)(true);
        } else {
          runOnJS(setTabFocused)(false);
        }
      }
    },
    []
  );

  return tabFocused && isFocused;
};
