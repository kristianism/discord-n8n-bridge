export class ConfigError extends Error {
  override readonly name = "ConfigError";

  constructor(message: string) {
    super(message);
  }
}

export class DeliveryShedError extends Error {
  override readonly name = "DeliveryShedError";

  constructor(message = "delivery capacity exhausted") {
    super(message);
  }
}
