export type CommerceAction = "buy" | "sell" | "register" | "contact";

export type CommerceStep =
  | "domain"
  | "budget"
  | "purpose"
  | "price"
  | "negotiable"
  | "listed"
  | "contact"
  | "message";

export type CommerceData = {
  submission_id?: string;
  completion_update_id?: number;
  domain?: string;
  source: string;
  report_token?: string;
  service?: "register";
  budget?: string;
  purpose?: string;
  price?: string;
  negotiable?: string;
  listed?: string;
  contact?: string;
  message?: string;
  pending_check?: string;
};

export type CommerceSession = {
  flow: CommerceAction;
  step: CommerceStep;
  data: CommerceData;
  updatedAt?: string;
};

export type CommercePrompt =
  | "buy_domain"
  | "buy_budget"
  | "buy_purpose"
  | "buy_contact"
  | "sell_domain"
  | "sell_price"
  | "sell_negotiable"
  | "sell_listed"
  | "sell_contact"
  | "register_domain"
  | "register_contact"
  | "contact_message";

export type CommerceLead = {
  leadType: "buy" | "sell" | "contact";
  data: CommerceData;
};

export type CommerceTransition =
  | { kind: "prompt"; prompt: CommercePrompt; session: CommerceSession }
  | { kind: "complete"; lead: CommerceLead }
  | { kind: "invalid"; reason: "invalid_domain" | "invalid_choice" | "empty_text" | "invalid_contact"; session: CommerceSession };

export type CommerceStartContext = {
  domain?: string;
  source: string;
  reportToken?: string;
};

export type CommerceChoice =
  | `budget:${"under_5k" | "5k_20k" | "under_20k" | "20k_100k" | "100k_500k" | "over_500k" | "over_100k" | "unsure"}`
  | `purpose:${"brand" | "startup" | "investment" | "website" | "other"}`
  | `price:${"quote" | "unsure"}`
  | `negotiable:${"yes" | "no" | "maybe"}`
  | `listed:${"yes" | "no"}`;
