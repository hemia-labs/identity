import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import { envValidationSchema } from "../../../../../backend/src/config/env.validation";
import { MailModule } from "../../../../../backend/src/modules/mail/mail.module";
import { MailService } from "../../../../../backend/src/modules/mail/mail.service";
import { EMAIL_SENDER_CLIENT } from "../../../../../backend/src/modules/mail/mail.constants";

const production = {
  NODE_ENV: "production",
  ID_FRONTEND_URL: "https://id.example.test",
  ACCESS_API_URL: "https://access.example.test",
  ACCESS_JWKS_URI: "https://access.example.test/.well-known/jwks.json",
  JWT_ACCESS_SECRET: "a".repeat(64),
  JWT_REFRESH_SECRET: "b".repeat(64),
  OAUTH_STATE_SECRET: "c".repeat(64),
};

describe("Optional SMTP", () => {
  it("accepts production without SMTP or with all credentials empty", () => {
    expect(envValidationSchema.validate(production).error).toBeUndefined();
    expect(
      envValidationSchema.validate({
        ...production,
        SMTP_HOST: "",
        SMTP_USER: "",
        SMTP_PASS: "",
      }).error,
    ).toBeUndefined();
    expect(
      envValidationSchema.validate({
        ...production,
        SMTP_HOST: "smtp.example.test",
      }).error,
    ).toBeDefined();
    expect(
      envValidationSchema.validate({
        ...production,
        SMTP_HOST: "smtp.example.test",
        SMTP_USER: "test",
        SMTP_PASS: "test",
      }).error,
    ).toBeUndefined();
  });

  it("initializes MailModule without a client and rejects sending explicitly", async () => {
    const module = await Test.createTestingModule({ imports: [MailModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({ email: { host: "", user: "", pass: "" } }))
      .compile();
    try {
      await module.init();
      expect(module.get(EMAIL_SENDER_CLIENT)).toBeNull();
      await expect(
        module
          .get(MailService)
          .send({ to: "user@example.test", subject: "Test", template: "test" }),
      ).rejects.toMatchObject({ response: { code: "EMAIL_NOT_CONFIGURED" } });
    } finally {
      await module.close();
    }
  });

  it("keeps configured email delivery working", async () => {
    const sendEmail = jest.fn().mockResolvedValue({ sent: true });
    const service = new MailService(
      { sendEmail } as never,
      new ConfigService({ email: { app: "Hemia ID" } }),
    );
    await expect(
      service.send({
        to: "user@example.test",
        subject: "Test",
        template: "test",
      }),
    ).resolves.toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ app: "Hemia ID" }),
    );
    sendEmail.mockRejectedValueOnce(new Error("SMTP failed"));
    await expect(
      service.send({
        to: "user@example.test",
        subject: "Test",
        template: "test",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
