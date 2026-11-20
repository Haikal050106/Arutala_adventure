export function mergeCustomerList(current, incoming) {
  const customersById = new Map(current.map((customer) => [String(customer.id), customer]))
  incoming.forEach((customer) => customersById.set(String(customer.id), customer))
  return [...customersById.values()].sort((a, b) => a.name.localeCompare(b.name))
}
