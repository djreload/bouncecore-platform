export type ProducerActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialProducerActionState: ProducerActionState = {
  status: "idle"
};
