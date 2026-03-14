import { IsString, IsNotEmpty, Matches, IsIn } from 'class-validator';

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export class SendSmsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid Chinese mobile' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['register', 'login', 'reset_password'], {
    message: 'purpose must be register | login | reset_password',
  })
  purpose!: 'register' | 'login' | 'reset_password';
}
