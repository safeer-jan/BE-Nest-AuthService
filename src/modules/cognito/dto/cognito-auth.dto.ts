import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class CognitoSignUpDto {
  @ApiProperty() @IsEmail()
  email!: string;
  @ApiProperty() @IsString()
  password!: string;
}

export class CognitoConfirmDto {
  @ApiProperty() @IsEmail()
  email!: string;
  @ApiProperty() @IsString()
  code!: string;
}

export class CognitoLoginDto {
  @ApiProperty() @IsEmail()
  email!: string;
  @ApiProperty() @IsString()
  password!: string;
}
