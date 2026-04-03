import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DbService } from 'src/db/db.service';
import { randomUUID } from 'crypto';

@Injectable()
export class CategoryService {
constructor(private readonly db: DbService) {}

  create(dto: CreateCategoryDto) {
    const newCategory = {
      id: randomUUID(),
      ...dto,
    };
    this.db.categories.push(newCategory);
    return newCategory;
  }

  findAll() {
    return this.db.categories;
  }

  findOne(id: string) {
    const category = this.db.categories.find((c) => c.id === id);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  update(id: string, dto: UpdateCategoryDto) {
    const category = this.findOne(id);
    Object.assign(category, dto);
    return category;
  }

  remove(id: string) {
    const index = this.db.categories.findIndex((c) => c.id === id);
    if (index === -1) throw new NotFoundException('Category not found');

    this.db.articles.forEach((article) => {
      if (article.categoryId === id) {
        article.categoryId = null;
      }
    });

    this.db.categories.splice(index, 1);
  }
}
