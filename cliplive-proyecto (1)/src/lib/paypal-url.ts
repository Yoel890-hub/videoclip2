// Dirección del programa de botones de PayPal (la misma en el servidor y en la página).
export function paypalSdkUrl(clientId: string) {
  return `https://www.paypal.com/sdk/js?${new URLSearchParams({
    "client-id": clientId, currency: "USD", vault: "true", intent: "subscription", "enable-funding": "card",
  })}`;
}
