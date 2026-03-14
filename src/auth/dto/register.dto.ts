import {
  IsString,
  IsNotEmpty,
  Matches,
  MinLength,
  MaxLength,
  Length,
} from 'class-validator';

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,32}$/;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid Chinese mobile (1[3-9]xxxxxxxxx)' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'password must be 8-32 characters' })
  @MaxLength(32)
  @Matches(PASSWORD_REGEX, {
    message: 'password must contain upper, lower case and digit',
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  nickname!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'verifyCode must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'verifyCode must be 6 digits' })
  verifyCode!: string;
}
