/* Jest setup: lightweight mocks for native modules so screens and logic run in Node. */
/* eslint-disable @typescript-eslint/no-require-imports */

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return { ...mock, useReducedMotion: () => false, default: { ...mock.default } };
});

// Skia draws on a GPU canvas. In tests the canvas is a plain View and primitives render nothing.
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const chain: object = new Proxy({}, { get: (_t, key) => (key === 'build' ? () => ({}) : () => chain) });
  const Skia = {
    Path: { Make: () => chain, MakeFromSVGString: () => ({}) },
    PathBuilder: { Make: () => chain },
    Paint: () => chain,
    PictureRecorder: () => ({ beginRecording: () => chain, finishRecordingAsPicture: () => ({}) }),
    Color: (c: unknown) => c,
    XYWHRect: () => ({}),
    RRectXY: () => ({}),
    Point: (x: number, y: number) => ({ x, y }),
  };
  const Canvas = ({ children: _children, ...props }: Record<string, unknown>) => React.createElement(View, props);
  const Null = () => null;
  const named: Record<string, unknown> = {
    __esModule: true,
    Skia,
    Canvas,
    vec: (x: number, y: number) => ({ x, y }),
    rect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    useFont: () => null,
    matchFont: () => null,
    useClock: () => ({ value: 0 }),
    BlendMode: {},
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Round: 1 },
    StrokeJoin: { Round: 1 },
    TileMode: { Clamp: 0 },
  };
  return new Proxy(named, { get: (target, key: string) => (key in target ? target[key] : Null) });
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const El = ({ children }: { children?: unknown }) => React.createElement(View, null, children);
  return new Proxy({ __esModule: true, default: El }, { get: (t: Record<string, unknown>, k: string) => (k in t ? t[k] : El) });
});

jest.mock('expo-audio', () => {
  const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), remove: jest.fn(), volume: 1, loop: false, playing: false };
  return { createAudioPlayer: jest.fn(() => player), setAudioModeAsync: jest.fn(() => Promise.resolve()) };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-file-system', () => ({ Paths: { document: '/doc' }, File: jest.fn(), Directory: jest.fn() }));

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() };
  return { router, useRouter: () => router, useLocalSearchParams: jest.fn(() => ({})), useFocusEffect: jest.fn(), Stack: () => null, Link: () => null };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
    SafeAreaView: ({ children }: { children: unknown }) => React.createElement(require('react-native').View, null, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});
