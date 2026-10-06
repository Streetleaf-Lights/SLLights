import { act, fireEvent, render, screen } from "@testing-library/react-native";
import PoleScreen from "../app/(tabs)/(home)/project/[customerId]/[projectId]/pole/[poleId]";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makePoleDetail, makeToken, withSignedInAuth } from "../test-utils/helpers";

const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ customerId: "c1", projectId: "p1", poleId: "pole1" }),
  useNavigation: () => ({ setOptions: mockSetOptions, goBack: mockGoBack }),
}));

beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

it("loads the pole by id and names the project on the back button", async () => {
  const token = makeToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp: futureExp() });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role: "Customer Owner", customerId: "c1" } });
  const api = fakeApi({ getPoleDetail: jest.fn().mockResolvedValue(makePoleDetail(true)) });
  await render(<PoleScreen />, { wrapper: withSignedInAuth(api) });

  expect(await screen.findByRole("header", { name: "PAS-1" })).toBeTruthy();
  expect(api.getPoleDetail).toHaveBeenCalledWith("c1", "p1", "pole1");
  // The screen draws its own back button: "‹ North Corridor".
  const options = mockSetOptions.mock.calls.map(([o]) => o).find((o) => o.headerLeft);
  await render(options.headerLeft());
  expect(screen.getByText("North Corridor")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back to North Corridor" }));
  expect(mockGoBack).toHaveBeenCalled();
});
