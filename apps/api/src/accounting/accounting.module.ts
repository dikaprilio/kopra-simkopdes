import { Module } from '@nestjs/common';
import { CoaController } from './coa.controller';
import { CoaService } from './coa.service';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

@Module({
  controllers: [CoaController, JournalController],
  providers: [CoaService, JournalService],
  exports: [JournalService],
})
export class AccountingModule {}
