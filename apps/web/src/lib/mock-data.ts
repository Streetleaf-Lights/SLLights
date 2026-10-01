import type { User } from "./types";

export const mockUsers: User[] = [
  {
    id: "user1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "Customer Admin",
    status: "Active",
    customerId: "cust1",
    customerName: "Acme Corp",
  },
  {
    id: "user-02",
    name: "Marcus Ellery",
    email: "marcus.ellery@internal.co",
    role: "Editor",
    status: "Active",
    customerId: "cust-002",
    customerName: "Coastal Power & Light",
  },
  {
    id: "user-03",
    name: "Priya Nandakumar",
    email: "priya.nandakumar@internal.co",
    role: "Viewer",
    status: "Active",
    customerId: "cust-003",
    customerName: "Highline Telecom Cooperative",
  },
  {
    id: "user-04",
    name: "Colin Ashworth",
    email: "colin.ashworth@internal.co",
    role: "Viewer",
    status: "Inactive",
    customerId: "cust-004",
    customerName: "Summit Rural Electric",
  },
];
