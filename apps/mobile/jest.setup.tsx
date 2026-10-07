// Every test gets a deterministic API URL; screen tests inject a fake client anyway.
process.env.EXPO_PUBLIC_API_BASE_URL = "https://sllights.test";

// In-memory Keychain/Keystore.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
    __store: store,
  };
});

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

beforeEach(() => {
  (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store.clear();
});

// Native map views can't run under Jest: stand-ins that render plain Views
// carrying the props the app passed (region, interaction flags, marker).
jest.mock("react-native-maps", () => {
  const { View } = jest.requireActual("react-native");
  const MapView = (props: Record<string, unknown>) => <View {...props} />;
  const Marker = (props: Record<string, unknown>) => <View testID="map-marker" {...props} />;
  return { __esModule: true, default: MapView, Marker };
});

// The native slider can't run under Jest: a View carrying its props.
jest.mock("@react-native-community/slider", () => {
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <View {...props} /> };
});
