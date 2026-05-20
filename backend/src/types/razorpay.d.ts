declare module 'razorpay' {
  type RazorpayOptions = {
    key_id: string;
    key_secret: string;
  };

  type OrderCreateOptions = {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  };

  type Order = {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  };

  export default class Razorpay {
    constructor(options: RazorpayOptions);
    orders: {
      create(options: OrderCreateOptions): Promise<Order>;
    };
  }
}
