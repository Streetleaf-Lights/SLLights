import { fireEvent, render, screen } from "@testing-library/react-native";
import ProjectScreen from "../app/(tabs)/(home)/project/[customerId]/[projectId]";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ customerId: "c1", projectId: "p1" }),
  useNavigation: () => ({ setOptions: mockSetOptions, goBack: mockGoBack }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const project = {
  customer: { id: "c1", name: "Coastal Power" },
  project: { id: "p1", name: "North Corridor", active: true, totalLights: 0, connectedLights: 0, totalFaults: 0, percentWorking: null },
  poles: [],
};

describe("ProjectScreen", () => {
  beforeEach(async () => {
    mockSetOptions.mockClear();
    const token = makeToken({ sub: "u1", role: "Streetleaf Admin", exp: futureExp() });
    await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role: "Streetleaf Admin", customerId: null } });
  });

  it("names the customer on the back button once the project loads, without titling the top bar", async () => {
    const api = fakeApi({ getProject: jest.fn().mockResolvedValue(project) });
    await render(<ProjectScreen />, { wrapper: withSignedInAuth(api) });

    expect(await screen.findByText("North Corridor")).toBeTruthy(); // the name lives in the page header
    // The screen draws its own back button: "‹ Coastal Power".
    const options = mockSetOptions.mock.calls.map(([o]) => o).find((o) => o.headerLeft);
    await render(options.headerLeft());
    expect(screen.getByText("Coastal Power")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back to Coastal Power" }));
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockSetOptions).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.anything() }));
  });
});
