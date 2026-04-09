import { PrismaClient, Role, Status } from "@prisma/client";

const prisma = new PrismaClient();
    console.log('🌱 Start seeding...');

async function main() {
    const admin = await prisma.user.upsert({
        where: {login: 'admin'},
        update: {},
        create: {
            login: 'admin',
            password: 'hashed_password_123',
            role: Role.ADMIN,
        },
    });

    const editor = await prisma.user.upsert({
        where: {login: 'editor'},
        update: {},
        create: {
            login: 'editor',
            password: 'hashed_password_456',
            role: Role.EDITOR,
        },
    });

    const catTech = await prisma.category.create({
        data: {
            name: 'Technology',
            description: 'Articles related to technology',
        },
    });

    const catScience = await prisma.category.create({
        data: {
            name: 'Science',
            description: 'Articles related to science',
        },
    });

    const catLifeStyle = await prisma.category.create({
        data: {
            name: 'Lifestyle',
            description: 'Articles related to lifestyle',
        },
    });
    const tags = await Promise.all([
    prisma.tag.create({data: {name: 'docker'}}),
    prisma.tag.create({data: {name: 'nestjs'}}),
    prisma.tag.create({data: {name: 'prisma'}}),
    prisma.tag.create({data: {name: 'backend'}}),
    prisma.tag.create({data: {name: 'api'}}),
   ]);

    const art1 = await prisma.article.create({
      data: {
        title: 'First article',
        content: 'Content about nestjs',
        authorId: admin.id,
        categoryId: catTech.id,
        status: Status.PUBLISHED,
        tags: {
            connect: [{name: 'nestjs'}, {name: 'backend'}],
        },
    },
});

   await prisma.article.create({
    data: {
      title: 'Docker basics',
      content: 'Learning containers...',
      authorId: editor.id,
      categoryId: catTech.id,
      status: Status.DRAFT,
      tags: { connect: [{ name: 'docker' }] },
    },
  });

    await prisma.article.create({
    data: {
      title: 'Prisma Guide',
      content: 'ORM secrets...',
      authorId: admin.id,
      categoryId: catScience.id,
      status: Status.PUBLISHED,
      tags: { connect: [{ name: 'prisma' }, { name: 'backend' }] },
    },
  });


   await prisma.article.create({
    data: {
      title: 'API Design',
      content: 'REST vs GraphQL...',
      authorId: editor.id,
      categoryId: catTech.id,
      status: Status.PUBLISHED,
      tags: { connect: [{ name: 'api' }, { name: 'backend' }] },
    },
  });

  await prisma.article.create({
    data: {
      title: 'Future of AI',
      content: 'What is next?',
      authorId: editor.id,
      categoryId: catLifeStyle.id,
      status: Status.ARCHIVED,
      tags: { connect: [{ name: 'api' }] },
    },
  });


    await prisma.comment.createMany({
        data: [
            {content: 'Great article!', authorId: editor.id, articleId: art1.id,},
            { content: 'Check this out!', authorId: admin.id, articleId: art1.id,},
            {content: 'Great job!', authorId: editor.id, articleId: art1.id,}
    ],
    });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('✅ Seeding finished.');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });