interface KkiapaySuccessData {
  transactionId: string;
}

interface Window {
  openKkiapayWidget: (config: {
    amount: number;
    position?: string;
    sandbox?: boolean;
    key: string;
    callback?: string;
    data?: string;
  }) => void;
  addKkiapayListener: (
    event: "success" | "failed" | "close",
    callback: (data: KkiapaySuccessData) => void
  ) => void;
  removeKkiapayListener: (event: "success" | "failed" | "close") => void;
}
