import { IsString, IsNotEmpty, Matches } from 'class-validator';

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid Chinese mobile' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
