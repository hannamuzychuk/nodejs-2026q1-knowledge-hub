import { Injectable } from '@nestjs/common';

@Injectable()
export class DbService {
    users = [];
    articles = [];
    categories = [];
    comments = [];
}
