import React, {
  CSSProperties,
  useMemo,
  useRef,
  useEffect,
  MutableRefObject,
} from "react";

import type { FlashListProps, ViewToken } from "@shopify/flash-list";
import { VirtuosoGrid, Virtuoso } from "react-virtuoso";
import type {
  GridListProps,
  GridItem,
  VirtuosoHandle,
  VirtuosoGridProps,
  VirtuosoGridHandle,
  GridComponents,
} from "react-virtuoso";

import type { InfiniteScrollListProps } from ".";

const ioConfiguration = {
  // will trigger intersection callback when item is 70% visible
  threshold: 0.7,
};

export type InfiniteScrollListWebProps<T> = Omit<
  InfiniteScrollListProps<T>,
  "onEndReached"
> & {
  onEndReached?: VirtuosoGridProps["endReached"];
  onViewableItemsChanged?: FlashListProps<T>["onViewableItemsChanged"];
  gridItemProps?: React.HTMLAttributes<HTMLDivElement>;
};

const renderComponent = (Component: any) => {
  if (!Component) return null;
  if (React.isValidElement(Component)) return Component;
  return <Component />;
};

const ViewabilityTracker = ({
  index,
  item,
  children,
  onViewableItemsChanged,
  viewableItems,
}: {
  index: number;
  item: any;
  children: any;
  onViewableItemsChanged: FlashListProps<any>["onViewableItemsChanged"];
  viewableItems: MutableRefObject<ViewToken[]>;
}) => {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (onViewableItemsChanged) {
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (!viewableItems.current.find((v) => v.index === index))
            viewableItems.current.push({
              item,
              index,
              isViewable: true,
              key: index.toString(),
              timestamp: new Date().valueOf(),
            });
        } else {
          viewableItems.current = viewableItems.current.filter(
            (v) => v.index !== index
          );
        }

        onViewableItemsChanged?.({
          viewableItems: viewableItems.current,

          // TODO: implement changed
          changed: [],
        });
      }, ioConfiguration);

      observer.observe(ref.current);
      return () => {
        observer.disconnect();
      };
    }
  }, [onViewableItemsChanged, viewableItems, index, item]);

  return <div ref={ref}>{children}</div>;
};

export function VirtuosoListComponent<T>(
  {
    renderItem,
    data,
    onEndReached,
    ListHeaderComponent,
    ListFooterComponent,
    ItemSeparatorComponent,
    ListEmptyComponent,
    numColumns = 1,
    overscan,
    useWindowScroll = true,
    style,
    onViewableItemsChanged,
    gridItemProps = {},
  }: InfiniteScrollListWebProps<T>,
  ref: React.Ref<VirtuosoHandle> | React.Ref<VirtuosoGridHandle>
) {
  const viewableItems = useRef<ViewToken[]>([]);

  const renderItemContent = React.useCallback(
    (index: number) => {
      if (data && data[index]) {
        const element = renderItem?.({
          item: data[index],
          index,
          target: "Cell",
        });
        return (
          <ViewabilityTracker
            index={index}
            item={data[index]}
            viewableItems={viewableItems}
            onViewableItemsChanged={onViewableItemsChanged}
          >
            {element}
            {index < data.length - 1 && renderComponent(ItemSeparatorComponent)}
          </ViewabilityTracker>
        );
      }

      return null;
    },
    [data, ItemSeparatorComponent, renderItem, onViewableItemsChanged]
  );

  const gridComponents = useMemo(
    () => ({
      Item: (props: ItemContainerProps) => (
        <ItemContainer
          {...props}
          numColumns={numColumns}
          ItemSeparatorComponent={ItemSeparatorComponent}
          {...(gridItemProps as {})}
        />
      ),
      List: ListContainer,
    }),
    [ItemSeparatorComponent, gridItemProps, numColumns]
  );

  if (data?.length === 0) {
    return renderComponent(ListEmptyComponent);
  }

  return (
    <>
      {numColumns > 1 && renderComponent(ListHeaderComponent)}
      {numColumns === 1 ? (
        <Virtuoso
          useWindowScroll={useWindowScroll}
          data={data ?? []}
          endReached={onEndReached}
          itemContent={renderItemContent}
          components={{
            Header: () => renderComponent(ListHeaderComponent),
            Footer: () => renderComponent(ListFooterComponent),
          }}
          overscan={overscan}
          style={style as CSSProperties}
          ref={ref as React.Ref<VirtuosoHandle>}
        />
      ) : (
        <VirtuosoGrid
          useWindowScroll={useWindowScroll}
          totalCount={data?.length || 0}
          components={gridComponents as GridComponents<T>}
          endReached={onEndReached}
          itemContent={renderItemContent}
          overscan={overscan}
          style={style as CSSProperties}
          ref={ref as React.Ref<VirtuosoGridHandle>}
        />
      )}
      {numColumns > 1 && renderComponent(ListFooterComponent)}
    </>
  );
}
export const InfiniteScrollList = React.forwardRef(VirtuosoListComponent);

const ListContainer = React.forwardRef(function ListContainer(
  props: GridListProps,
  ref: React.LegacyRef<HTMLDivElement>
) {
  return (
    <div
      {...props}
      style={{ ...props.style, display: "flex", flexWrap: "wrap" }}
      ref={ref}
    />
  );
});

type ItemContainerProps = GridItem &
  Pick<FlashListProps<any>, "ItemSeparatorComponent"> & {
    style?: CSSProperties;
    numColumns?: number;
    children?: JSX.Element;
  } & React.HTMLAttributes<HTMLDivElement>;

const ItemContainer = React.forwardRef(function ItemContainer(
  { style, ...rest }: ItemContainerProps,
  ref: React.LegacyRef<HTMLDivElement>
) {
  const width = rest.numColumns ? `${100 / rest.numColumns}%` : "100%";
  return (
    <div {...rest} style={{ ...style, width }} ref={ref}>
      {rest.children}
      {renderComponent(rest.ItemSeparatorComponent)}
    </div>
  );
});
