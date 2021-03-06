import * as React from 'react';
import { Font, Fonts, Options, CancelablePromise, InputFont } from './types';
import {
  dataWithFailedFont,
  dataWithLoadedFont,
  dataWithLoadingFont,
  load,
  noop,
} from './helpers';

export interface State {
  [name: string]: Font;
}

/**
 * Wraps component with HoC and injects user-provided fonts props
 */
function withAsyncFonts<P>(
  fonts: Fonts,
  userOptions?: Options,
): (BaseComponent: React.ComponentType<any>) => React.ComponentClass<any> {
  const options: Options = {
    onFontTimeout: noop,
    onFontReady: noop,
    timeout: 5000,
    ...userOptions,
  };

  return BaseComponent => {
    const originalName =
      BaseComponent.displayName || BaseComponent.name || 'Component';

    return class WithAsyncFonts extends React.Component<P & State, State> {
      public static displayName = `withAsyncFonts(${originalName})`;

      private promises: Array<CancelablePromise<InputFont>> = [];

      constructor(props: any) {
        super(props);

        // Set default state with basic font values
        this.state = Object.keys(fonts).reduce((state, code) => {
          const font = fonts[code];
          return { ...state, [code]: dataWithLoadingFont(font) };
        }, {});
      }

      public componentDidMount() {
        const { onFontReady, onFontTimeout, timeout } = options;
        const keys = Object.keys(fonts);

        // Collect cancelable promises
        this.promises = keys.reduce(
          (promises, code) => [...promises, load(fonts[code], timeout)],
          [],
        );

        // Resolve fonts
        this.promises.forEach((promise, index) => {
          const timing = Date.now();
          const key = keys[index];
          const inputFont = fonts[key];
          promise
            .then(resolvedFont => {
              const loadedFont = dataWithLoadedFont({
                ...inputFont,
                ...resolvedFont,
                timing: Date.now() - timing,
              });
              this.setState(
                () => ({ [key]: loadedFont }),
                () => (onFontReady ? onFontReady(loadedFont) : null),
              );
            })
            .catch(({ isCanceled }) => {
              if (isCanceled) {
                return; // Do nothing
              }
              const fallbackFont = dataWithFailedFont(inputFont);
              this.setState(
                () => ({ [key]: fallbackFont }),
                () => (onFontTimeout ? onFontTimeout(fallbackFont) : null),
              );
            });
        });
      }

      public componentWillUnmount() {
        // Mark all promises as canceled once component is unmounted
        this.promises.forEach(
          promise => (promise.cancel ? promise.cancel() : null),
        );
      }

      public render() {
        return <BaseComponent {...this.props} {...this.state} />;
      }
    };
  };
}

export default withAsyncFonts;
